// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step}    from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";
import {Market}          from "./Market.sol";

/// @title  OracleJob
/// @author Bruh Protocol
/// @notice ERC-8183 inspired resolution job contract.
///
/// ┌─────────────────────────────────────────────────────────────────────────┐
/// │  FLOW                                                                   │
/// │                                                                         │
/// │  1. Anyone calls createJob(market) after market.closeTime               │
/// │     → resolution fee escrowed from caller in USDC                      │
/// │     → oracle is notified via event                                      │
/// │                                                                         │
/// │  2. Oracle accepts job: acceptJob(jobId)                                │
/// │     → oracle posts a USDC bond (slashed if disputed)                   │
/// │                                                                         │
/// │  3. Oracle submits outcome: submitOutcome(jobId, outcome, evidenceURI)  │
/// │     → outcome staged, dispute window opens (24h)                       │
/// │                                                                         │
/// │  4a. No dispute → anyone calls finalise(jobId) after window            │
/// │      → market.resolve(outcome) called                                  │
/// │      → oracle receives fee + bond back                                 │
/// │                                                                         │
/// │  4b. Dispute raised → dispute(jobId) within window                     │
/// │      → owner arbitrates: uphold(jobId) or overturn(jobId, newOutcome)  │
/// │      → uphold: oracle keeps bond + fee                                 │
/// │      → overturn: bond slashed to treasury, fee returned to requester   │
/// └─────────────────────────────────────────────────────────────────────────┘

contract OracleJob is ReentrancyGuard, Ownable2Step {
    using SafeERC20 for IERC20;

    
    // Constants
    

    /// @notice Resolution fee paid by job requester (1 USDC)
    uint256 public constant RESOLUTION_FEE = 1e6;

    /// @notice Oracle bond (5 USDC — slashed on overturn)
    uint256 public constant ORACLE_BOND = 5e6;

    /// @notice Dispute window after outcome submission (24 hours)
    uint256 public constant DISPUTE_WINDOW = 24 hours;

    /// @notice Maximum time oracle has to accept a job (48 hours)
    uint256 public constant ACCEPT_DEADLINE = 48 hours;

    /// @notice Maximum time oracle has to submit outcome after accepting (72 hours)
    uint256 public constant SUBMIT_DEADLINE = 72 hours;

    
    // Types
    

    enum JobStatus {
        OPEN,       // created, waiting for oracle to accept
        ACCEPTED,   // oracle accepted, bond posted
        SUBMITTED,  // outcome submitted, in dispute window
        FINALISED,  // outcome accepted, market resolved
        DISPUTED,   // under arbitration
        OVERTURNED, // arbitrator overturned oracle's outcome
        EXPIRED     // oracle failed to act in time — fee refunded
    }

    struct Job {
        address  market;         // Market contract to resolve
        address  requester;      // Who created the job (paid fee)
        address  oracle;         // Oracle that accepted the job
        uint256  createdAt;      // Job creation timestamp
        uint256  acceptedAt;     // When oracle accepted
        uint256  submittedAt;    // When outcome was submitted
        uint256  fee;            // USDC fee escrowed
        uint256  bond;           // USDC bond posted by oracle
        Market.Outcome outcome;  // Submitted outcome
        string   evidenceURI;    // IPFS/HTTPS link to resolution evidence
        JobStatus status;        // Current job state
        bool     disputed;       // True if dispute was raised
    }

    
    // State
    

    IERC20  public immutable usdc;
    address public treasury;

    uint256 public nextJobId;
    /// @notice Running total of USDC held in escrow + pending payouts
    uint256 public totalEscrowed;

    mapping(uint256 => Job) public jobs;

    /// @notice Authorised oracles (only these can accept jobs)
    mapping(address => bool) public authorisedOracles;

    /// @notice One active job per market (prevents duplicate jobs)
    mapping(address => uint256) public activeJobByMarket;
    mapping(address => bool)    public hasActiveJob;

    /// @notice ARC-SPECIFIC: pull-based payouts (blocklist safety)
    /// Credited on finalise/uphold/overturn/expire — claimed via claimPayout()
    mapping(address => uint256) public pendingPayouts;

    
    // Events
    

    event JobCreated(
        uint256 indexed jobId,
        address indexed market,
        address indexed requester,
        uint256 fee
    );
    event JobAccepted(
        uint256 indexed jobId,
        address indexed oracle,
        uint256 bond
    );
    event OutcomeSubmitted(
        uint256 indexed jobId,
        Market.Outcome outcome,
        string evidenceURI,
        uint256 disputeDeadline
    );
    event JobFinalised(
        uint256 indexed jobId,
        Market.Outcome outcome,
        address indexed oracle,
        uint256 payout
    );
    event JobDisputed(
        uint256 indexed jobId,
        address indexed disputer
    );
    event JobUpheld(
        uint256 indexed jobId,
        address indexed oracle
    );
    event JobOverturned(
        uint256 indexed jobId,
        Market.Outcome newOutcome,
        uint256 bondSlashed
    );
    event JobExpired(
        uint256 indexed jobId,
        address indexed requester,
        uint256 feeRefunded
    );
    event OracleAuthorised(address indexed oracle, bool authorised);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event PayoutCredited(address indexed recipient, uint256 amount);
    event PayoutClaimed(address indexed recipient, uint256 amount);
    event Skimmed(address indexed treasury, uint256 amount);
    
    // Errors
    

    error InvalidAddress();
    error InvalidMarket();
    error MarketNotClosed();
    error MarketAlreadyHasJob();
    error JobNotOpen();
    error JobNotAccepted();
    error JobNotSubmitted();
    error JobNotDisputed();
    error NotAuthorisedOracle();
    error NotJobOracle();
    error DisputeWindowOpen();
    error DisputeWindowClosed();
    error AcceptDeadlinePassed();
    error SubmitDeadlinePassed();
    error DeadlineNotPassed();
    error InvalidOutcome();
    error AlreadyDisputed();
    error NothingToClaim();
    error NothingToSkim();
    
    // Constructor
    

    constructor(address _usdc, address _treasury, address _owner) Ownable(_owner) {
        if (_usdc     == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();

        usdc     = IERC20(_usdc);
        treasury = _treasury;
    }

    
    // Job Lifecycle
    

    /// @notice Create a resolution job for a closed market.
    ///         Caller pays RESOLUTION_FEE in USDC up front.
    ///
    /// @param  market  Address of the Market contract to resolve
    /// @return jobId   Unique job identifier
    function createJob(address market)
        external
        nonReentrant
        returns (uint256 jobId)
    {
        if (market == address(0)) revert InvalidAddress();
        if (hasActiveJob[market]) revert MarketAlreadyHasJob();

        // Market must be past closeTime
        Market m = Market(market);
        (,,,,,,,,bool open,) = m.summary();
        if (open) revert MarketNotClosed();

        // Pull resolution fee from requester
        usdc.safeTransferFrom(msg.sender, address(this), RESOLUTION_FEE);

        jobId = nextJobId++;

        jobs[jobId] = Job({
            market:      market,
            requester:   msg.sender,
            oracle:      address(0),
            createdAt:   block.timestamp,
            acceptedAt:  0,
            submittedAt: 0,
            fee:         RESOLUTION_FEE,
            bond:        0,
            outcome:     Market.Outcome.UNRESOLVED,
            evidenceURI: "",
            status:      JobStatus.OPEN,
            disputed:    false
        });

        hasActiveJob[market]       = true;
        activeJobByMarket[market]  = jobId;

        // Signal market so agents pick it up
        m.requestResolution();

        emit JobCreated(jobId, market, msg.sender, RESOLUTION_FEE);
    }

    /// @notice Mark a job expired if oracle failed to accept in time.
    function expireJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.status != JobStatus.OPEN) revert JobNotOpen();
        if (block.timestamp <= job.createdAt + ACCEPT_DEADLINE) revert DeadlineNotPassed();
        _expireJob(jobId);
    }


    function _expireJob(uint256 jobId) internal {
        Job storage job = jobs[jobId];
        job.status = JobStatus.EXPIRED;

        uint256 refund = job.fee;
        job.fee = 0;
        hasActiveJob[job.market] = false;

        if (refund > 0) {
            pendingPayouts[job.requester] += refund;
            emit PayoutCredited(job.requester, refund);
        }

        emit JobExpired(jobId, job.requester, refund);
    }

    /// @notice Oracle accepts a job and posts a bond.
    ///         Must be called within ACCEPT_DEADLINE of job creation.
    ///
    /// @param jobId  Job to accept
    function acceptJob(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];

        if (!authorisedOracles[msg.sender]) revert NotAuthorisedOracle();
        if (job.status != JobStatus.OPEN)   revert JobNotOpen();

        // Enforce accept deadline
        if (block.timestamp > job.createdAt + ACCEPT_DEADLINE) {
            _expireJob(jobId);
            revert AcceptDeadlinePassed();
        }

        // Pull bond from oracle
        usdc.safeTransferFrom(msg.sender, address(this), ORACLE_BOND);

        job.oracle     = msg.sender;
        job.acceptedAt = block.timestamp;
        job.bond       = ORACLE_BOND;
        job.status     = JobStatus.ACCEPTED;

        emit JobAccepted(jobId, msg.sender, ORACLE_BOND);
    }

    /// @notice Oracle submits the outcome with supporting evidence.
    ///         Starts the 24-hour dispute window.
    ///
    /// @param jobId        Job to submit for
    /// @param outcome      YES, NO, or INVALID
    /// @param evidenceURI  IPFS CID or HTTPS URL with resolution rationale
    function submitOutcome(
    uint256        jobId,
    Market.Outcome outcome,
    string calldata evidenceURI
        )
            external
            nonReentrant
        {
            Job storage job = jobs[jobId];

            if (job.status != JobStatus.ACCEPTED)    revert JobNotAccepted(); 
            if (msg.sender != job.oracle)            revert NotJobOracle();
            if (outcome == Market.Outcome.UNRESOLVED) revert InvalidOutcome();

       // Enforce submit deadline
        if (block.timestamp > job.acceptedAt + SUBMIT_DEADLINE) {
            revert SubmitDeadlinePassed();
        }

        job.outcome      = outcome;
        job.evidenceURI  = evidenceURI;
        job.submittedAt  = block.timestamp;
        job.status       = JobStatus.SUBMITTED;

        emit OutcomeSubmitted(
            jobId,
            outcome,
            evidenceURI,
            block.timestamp + DISPUTE_WINDOW
        );
    }

    /// @notice Finalise a job after the dispute window has passed.
    ///         Anyone can call this — resolves the market and pays the oracle.
    ///
    /// @param jobId  Job to finalise
    function finalise(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status != JobStatus.SUBMITTED) revert JobNotSubmitted();
        if (job.disputed)                      revert JobNotSubmitted();
        if (block.timestamp <= job.submittedAt + DISPUTE_WINDOW) {
            revert DisputeWindowOpen();
        }

        job.status = JobStatus.FINALISED;

        // Resolve market FIRST — decoupled from payment
        Market(job.market).resolve(job.outcome);

        // ARC: credit oracle instead of pushing — avoids blocklist brick
        uint256 payout = job.fee + job.bond;
        job.fee  = 0;
        job.bond = 0;
        hasActiveJob[job.market] = false;

        pendingPayouts[job.oracle] += payout;

        emit PayoutCredited(job.oracle, payout);
        emit JobFinalised(jobId, job.outcome, job.oracle, payout);
    }

    
    // Dispute
    

    /// @notice Raise a dispute within the dispute window.
    ///         Costs nothing — anyone can dispute.
    ///
    /// @param jobId  Job to dispute
function dispute(uint256 jobId) external {
    Job storage job = jobs[jobId];

    if (job.disputed) revert AlreadyDisputed(); // check this FIRST
    if (job.status != JobStatus.SUBMITTED) revert JobNotSubmitted();

    if (block.timestamp > job.submittedAt + DISPUTE_WINDOW) {
        revert DisputeWindowClosed();
    }

    job.disputed = true;
    job.status   = JobStatus.DISPUTED;

    emit JobDisputed(jobId, msg.sender);
}

    /// @notice Arbitrator upholds oracle's outcome.
    ///         Oracle keeps bond + fee.
    ///
    /// @param jobId  Disputed job
    function uphold(uint256 jobId) external onlyOwner nonReentrant {
        Job storage job = jobs[jobId];

        if (job.status != JobStatus.DISPUTED) revert JobNotDisputed();

        job.status = JobStatus.FINALISED;

        Market(job.market).resolve(job.outcome);

        uint256 payout = job.fee + job.bond;
        job.fee  = 0;
        job.bond = 0;
        hasActiveJob[job.market] = false;

        // ARC: credit, don't push
        pendingPayouts[job.oracle] += payout;

        emit PayoutCredited(job.oracle, payout);
        emit JobUpheld(jobId, job.oracle);
        emit JobFinalised(jobId, job.outcome, job.oracle, payout);
    }

    /// @notice Arbitrator overturns oracle's outcome.
    ///         Bond slashed to treasury. Fee refunded to requester.
    ///
    /// @param jobId       Disputed job
    /// @param newOutcome  Correct outcome as determined by arbitrator
  function overturn(uint256 jobId, Market.Outcome newOutcome)
        external
        onlyOwner
        nonReentrant
    {
        Job storage job = jobs[jobId];

        if (job.status != JobStatus.DISPUTED)        revert JobNotDisputed();
        if (newOutcome == Market.Outcome.UNRESOLVED)  revert InvalidOutcome();

        job.status  = JobStatus.OVERTURNED;
        job.outcome = newOutcome;

        Market(job.market).resolve(newOutcome);

        // ARC: credit both parties — either could be blocklisted
        uint256 slashedBond = job.bond;
        uint256 refundFee   = job.fee;
        job.bond = 0;
        job.fee  = 0;
        hasActiveJob[job.market] = false;

        pendingPayouts[treasury]      += slashedBond;
        pendingPayouts[job.requester] += refundFee;

        emit PayoutCredited(treasury,       slashedBond);
        emit PayoutCredited(job.requester,  refundFee);
        emit JobOverturned(jobId, newOutcome, slashedBond);
    }

   
    
    // Expiry
    

 
    // Admin
    

    /// @notice Authorise or deauthorise an oracle address.
    function setOracle(address oracle, bool authorised) external onlyOwner {
        if (oracle == address(0)) revert InvalidAddress();
        authorisedOracles[oracle] = authorised;
        emit OracleAuthorised(oracle, authorised);
    }

    /// @notice Update treasury address.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }


    //Payout Claims (Arc blocklist safety)

    /// @notice Claim any USDC owed to msg.sender.
    /// @dev    ARC-SPECIFIC: push payments replaced with pull to prevent a
    ///         blocklisted address from bricking market resolution.
    function claimPayout() external nonReentrant returns (uint256 amount) {
        amount = pendingPayouts[msg.sender];
        if (amount == 0) revert NothingToClaim();
        pendingPayouts[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);
        emit PayoutClaimed(msg.sender, amount);
    }


    /// @notice Total USDC accounted for: all pending payouts + all escrowed job funds.
    function _totalTracked() internal view returns (uint256 total) {
        // Sum all active job escrows (fee + bond)
        for (uint256 i; i < nextJobId; ++i) {
            total += jobs[i].fee + jobs[i].bond;
        }
        // Note: pendingPayouts are already funded from job escrows above,
        // so we don't double-count — once fee/bond zeroed, payout credited.
    }

    /// @notice Sweep untracked USDC to the treasury.
    /// @dev    ARC-SPECIFIC: SELFDESTRUCT endowments can credit this contract
    ///         outside our accounting. Recover them here.
  function skim() external nonReentrant returns (uint256 surplus) {
        uint256 balance = usdc.balanceOf(address(this));
        if (balance <= totalEscrowed) revert NothingToSkim();
        surplus = balance - totalEscrowed;
        usdc.safeTransfer(treasury, surplus);
        emit Skimmed(treasury, surplus);
    }

    
    // Views
    

    /// @notice Get full job details.
    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    /// @notice Is a job in its dispute window?
    function inDisputeWindow(uint256 jobId) external view returns (bool) {
        Job storage job = jobs[jobId];
        return job.status == JobStatus.SUBMITTED
            && block.timestamp <= job.submittedAt + DISPUTE_WINDOW;
    }

    /// @notice Has the accept deadline passed for an open job?
    function isExpired(uint256 jobId) external view returns (bool) {
        Job storage job = jobs[jobId];
        return job.status == JobStatus.OPEN
            && block.timestamp > job.createdAt + ACCEPT_DEADLINE;
    }

    
    // Internal
    


    function _slashAndRefund(uint256 jobId) internal {
        Job storage job = jobs[jobId];
        job.status = JobStatus.EXPIRED;

        uint256 bond = job.bond;
        uint256 fee  = job.fee;
        job.bond = 0;
        job.fee  = 0;
        hasActiveJob[job.market] = false;

        // ARC: credit both — don't push inline
        if (bond > 0) {
            pendingPayouts[treasury] += bond;
            emit PayoutCredited(treasury, bond);
        }
        if (fee > 0) {
            pendingPayouts[job.requester] += fee;
            emit PayoutCredited(job.requester, fee);
        }

        emit JobExpired(jobId, job.requester, fee);
    }


    /// @notice Slash oracle bond if submit deadline passed without submission.
    ///         Call this after submitOutcome reverts with SubmitDeadlinePassed.
    function slashExpiredSubmission(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.status != JobStatus.ACCEPTED) revert JobNotAccepted();
        if (block.timestamp <= job.acceptedAt + SUBMIT_DEADLINE) revert DeadlineNotPassed();
        _slashAndRefund(jobId);
    }

    
}