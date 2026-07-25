// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {OracleJob}      from "../src/OracleJob.sol";
import {Market}         from "../src/Market.sol";
import {ERC20}          from "@openzeppelin/contracts/token/ERC20/ERC20.sol";


// Mock USDC
 
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}


// Mock Market — minimal stub so OracleJob tests don't depend on Market logic

contract MockMarket {
    bool    public resolutionRequested;
    bool    public resolved;
    uint256 public closeTime;
    Market.Outcome public outcome;

    constructor(uint256 _closeTime) {
        closeTime = _closeTime;
    }

    /// @dev Mirrors Market.summary() return signature
    function summary() external view returns (
        string  memory question,
        uint256        _closeTime,
        Market.Outcome currentOutcome,
        uint256        yesPriceWad,
        uint256        noPriceWad,
        uint256        totalCollateral,
        uint256        yesShares,
        uint256        noShares,
        bool           open,
        bool           _resolved
    ) {
        question        = "Mock market question";
        _closeTime      = closeTime;
        currentOutcome  = outcome;
        yesPriceWad     = 0.5e18;
        noPriceWad      = 0.5e18;
        totalCollateral = 100e6;
        yesShares       = 0;
        noShares        = 0;
        open            = block.timestamp < closeTime;
        _resolved       = resolved;
    }

    function requestResolution() external {
        resolutionRequested = true;
    }

    function resolve(Market.Outcome _outcome) external {
        outcome  = _outcome;
        resolved = true;
    }
}

 
// Test contract
 
contract OracleJobTest is Test {

    // Actors 
    address internal owner;
    address internal oracle;
    address internal requester;
    address internal disputer;
    address internal treasury;
    address internal rogue;

    // Contracts 
    MockUSDC   internal usdc;
    OracleJob  internal jobContract;
    MockMarket internal market;

    //Constants
    uint256 internal constant FEE  = 1e6; // 1 USDC
    uint256 internal constant BOND = 5e6; // 5 USDC

     
    // Setup
     

    function setUp() public {
        owner     = makeAddr("owner");
        oracle    = makeAddr("oracle");
        requester = makeAddr("requester");
        disputer  = makeAddr("disputer");
        treasury  = makeAddr("treasury");
        rogue     = makeAddr("rogue");

        usdc        = new MockUSDC();
        jobContract = new OracleJob(address(usdc), treasury, owner);

        // Deploy a mock market that is already closed
        market = new MockMarket(block.timestamp - 1);

        // Fund actors
        usdc.mint(requester, 100e6);
        usdc.mint(oracle,    100e6);
        usdc.mint(rogue,     100e6);

        // Approvals
        vm.prank(requester);
        usdc.approve(address(jobContract), type(uint256).max);
        vm.prank(oracle);
        usdc.approve(address(jobContract), type(uint256).max);
        vm.prank(rogue);
        usdc.approve(address(jobContract), type(uint256).max);

        // Authorise oracle
        vm.prank(owner);
        jobContract.setOracle(oracle, true);
    }

     
    // Construction
     

    function test_construction() public view {
        assertEq(address(jobContract.usdc()), address(usdc));
        assertEq(jobContract.treasury(),      treasury);
        assertEq(jobContract.owner(),         owner);
        assertEq(jobContract.nextJobId(),     0);
    }

    function test_construction_reverts_zero_usdc() public {
        vm.expectRevert(OracleJob.InvalidAddress.selector);
        new OracleJob(address(0), treasury, owner);
    }

    function test_construction_reverts_zero_treasury() public {
        vm.expectRevert(OracleJob.InvalidAddress.selector);
        new OracleJob(address(usdc), address(0), owner);
    }

     
    // createJob
     

    function test_create_job() public {
        uint256 requesterBefore = usdc.balanceOf(requester);

        vm.prank(requester);
        uint256 jobId = jobContract.createJob(address(market));

        assertEq(jobId, 0);
        assertEq(jobContract.nextJobId(), 1);
        assertEq(usdc.balanceOf(requester), requesterBefore - FEE);
        assertTrue(jobContract.hasActiveJob(address(market)));
        assertTrue(market.resolutionRequested());

        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(job.market,    address(market));
        assertEq(job.requester, requester);
        assertEq(job.fee,       FEE);
        assertEq(uint8(job.status), uint8(OracleJob.JobStatus.OPEN));
    }

    function test_create_job_emits_event() public {
        vm.prank(requester);
        vm.expectEmit(false, true, true, true);
        emit OracleJob.JobCreated(0, address(market), requester, FEE);
        jobContract.createJob(address(market));
    }

    function test_create_job_reverts_zero_address() public {
        vm.prank(requester);
        vm.expectRevert(OracleJob.InvalidAddress.selector);
        jobContract.createJob(address(0));
    }

    function test_create_job_reverts_market_still_open() public {
        MockMarket openMarket = new MockMarket(block.timestamp + 1 days);
        vm.prank(requester);
        vm.expectRevert(OracleJob.MarketNotClosed.selector);
        jobContract.createJob(address(openMarket));
    }

    function test_create_job_reverts_duplicate() public {
        vm.prank(requester);
        jobContract.createJob(address(market));

        vm.prank(requester);
        vm.expectRevert(OracleJob.MarketAlreadyHasJob.selector);
        jobContract.createJob(address(market));
    }

     
    // acceptJob
     

    function test_accept_job() public {
        uint256 jobId = _createJob();
        uint256 oracleBefore = usdc.balanceOf(oracle);

        vm.prank(oracle);
        jobContract.acceptJob(jobId);

        assertEq(usdc.balanceOf(oracle), oracleBefore - BOND);

        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(job.oracle, oracle);
        assertEq(job.bond,   BOND);
        assertEq(uint8(job.status), uint8(OracleJob.JobStatus.ACCEPTED));
    }

    function test_accept_job_emits_event() public {
        uint256 jobId = _createJob();
        vm.prank(oracle);
        vm.expectEmit(true, true, false, true);
        emit OracleJob.JobAccepted(jobId, oracle, BOND);
        jobContract.acceptJob(jobId);
    }

    function test_accept_job_reverts_not_authorised() public {
        uint256 jobId = _createJob();
        vm.prank(rogue);
        vm.expectRevert(OracleJob.NotAuthorisedOracle.selector);
        jobContract.acceptJob(jobId);
    }

    function test_accept_job_reverts_not_open() public {
        uint256 jobId = _createJob();
        vm.prank(oracle);
        jobContract.acceptJob(jobId);

        // Try to accept again
        vm.prank(oracle);
        vm.expectRevert(OracleJob.JobNotOpen.selector);
        jobContract.acceptJob(jobId);
    }

    function test_accept_job_reverts_deadline_passed() public {
        uint256 jobId = _createJob();

        // Warp past accept deadline
        vm.warp(block.timestamp + jobContract.ACCEPT_DEADLINE() + 1);

        vm.prank(oracle);
        vm.expectRevert(OracleJob.AcceptDeadlinePassed.selector);
        jobContract.acceptJob(jobId);
    }

     
    // submitOutcome
     

    function test_submit_outcome_yes() public {
        uint256 jobId = _createAndAccept();

        vm.prank(oracle);
        jobContract.submitOutcome(jobId, Market.Outcome.YES, "ipfs://evidence");

        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(uint8(job.outcome), uint8(Market.Outcome.YES));
        assertEq(uint8(job.status),  uint8(OracleJob.JobStatus.SUBMITTED));
        assertEq(job.evidenceURI, "ipfs://evidence");
        assertGt(job.submittedAt, 0);
    }

    function test_submit_outcome_no() public {
        uint256 jobId = _createAndAccept();
        vm.prank(oracle);
        jobContract.submitOutcome(jobId, Market.Outcome.NO, "ipfs://evidence");
        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(uint8(job.outcome), uint8(Market.Outcome.NO));
    }

    function test_submit_outcome_invalid() public {
        uint256 jobId = _createAndAccept();
        vm.prank(oracle);
        jobContract.submitOutcome(jobId, Market.Outcome.INVALID, "ipfs://evidence");
        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(uint8(job.outcome), uint8(Market.Outcome.INVALID));
    }

    function test_submit_outcome_emits_event() public {
        uint256 jobId = _createAndAccept();
        vm.prank(oracle);
        vm.expectEmit(true, false, false, false);
        emit OracleJob.OutcomeSubmitted(jobId, Market.Outcome.YES, "ipfs://x", 0);
        jobContract.submitOutcome(jobId, Market.Outcome.YES, "ipfs://x");
    }

    function test_submit_outcome_reverts_not_oracle() public {
        uint256 jobId = _createAndAccept();
        vm.prank(rogue);
        vm.expectRevert(OracleJob.NotJobOracle.selector);
        jobContract.submitOutcome(jobId, Market.Outcome.YES, "ipfs://evidence");
    }

    function test_submit_outcome_reverts_not_accepted() public {
        uint256 jobId = _createJob();
        vm.prank(oracle);
        vm.expectRevert(OracleJob.JobNotAccepted.selector);
        jobContract.submitOutcome(jobId, Market.Outcome.YES, "ipfs://evidence");
    }

    function test_submit_outcome_reverts_unresolved() public {
        uint256 jobId = _createAndAccept();
        vm.prank(oracle);
        vm.expectRevert(OracleJob.InvalidOutcome.selector);
        jobContract.submitOutcome(jobId, Market.Outcome.UNRESOLVED, "");
    }

    function test_submit_outcome_reverts_deadline_passed() public {
        uint256 jobId = _createAndAccept();
        vm.warp(block.timestamp + jobContract.SUBMIT_DEADLINE() + 1);

        vm.prank(oracle);
        vm.expectRevert(OracleJob.SubmitDeadlinePassed.selector);
        jobContract.submitOutcome(jobId, Market.Outcome.YES, "ipfs://evidence");
    }

    function test_submit_deadline_slashes_bond() public {
        uint256 jobId = _createAndAccept();
        vm.warp(block.timestamp + jobContract.SUBMIT_DEADLINE() + 1);

        uint256 treasuryBefore   = usdc.balanceOf(treasury);
        uint256 requesterBefore  = usdc.balanceOf(requester);

        vm.prank(oracle);
        vm.expectRevert(OracleJob.SubmitDeadlinePassed.selector);
        jobContract.submitOutcome(jobId, Market.Outcome.YES, "");

        // Bond slashed to treasury, fee refunded to requester
        assertEq(usdc.balanceOf(treasury),  treasuryBefore  + BOND);
        assertEq(usdc.balanceOf(requester), requesterBefore + FEE);
    }

     
    // finalise
     

    function test_finalise_after_window() public {
        uint256 jobId = _createAcceptAndSubmit();

        // Warp past dispute window
        vm.warp(block.timestamp + jobContract.DISPUTE_WINDOW() + 1);

        uint256 oracleBefore = usdc.balanceOf(oracle);
        jobContract.finalise(jobId);

        // Oracle receives fee + bond
        assertEq(usdc.balanceOf(oracle), oracleBefore + FEE + BOND);

        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(uint8(job.status), uint8(OracleJob.JobStatus.FINALISED));
        assertEq(job.fee,  0);
        assertEq(job.bond, 0);

        // Market should be resolved
        assertTrue(market.resolved());
        assertEq(uint8(market.outcome()), uint8(Market.Outcome.YES));

        assertFalse(jobContract.hasActiveJob(address(market)));
    }

    function test_finalise_emits_event() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.warp(block.timestamp + jobContract.DISPUTE_WINDOW() + 1);
        vm.expectEmit(true, false, true, false);
        emit OracleJob.JobFinalised(jobId, Market.Outcome.YES, oracle, FEE + BOND);
        jobContract.finalise(jobId);
    }

    function test_finalise_reverts_window_still_open() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.expectRevert(OracleJob.DisputeWindowOpen.selector);
        jobContract.finalise(jobId);
    }

    function test_finalise_reverts_not_submitted() public {
        uint256 jobId = _createAndAccept();
        vm.warp(block.timestamp + jobContract.DISPUTE_WINDOW() + 1);
        vm.expectRevert(OracleJob.JobNotSubmitted.selector);
        jobContract.finalise(jobId);
    }

    function test_finalise_anyone_can_call() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.warp(block.timestamp + jobContract.DISPUTE_WINDOW() + 1);
        // rogue (not oracle) can finalise
        vm.prank(rogue);
        jobContract.finalise(jobId);
        assertEq(uint8(jobContract.getJob(jobId).status), uint8(OracleJob.JobStatus.FINALISED));
    }

     
    // dispute
     

    function test_dispute_within_window() public {
        uint256 jobId = _createAcceptAndSubmit();

        vm.prank(disputer);
        jobContract.dispute(jobId);

        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertTrue(job.disputed);
        assertEq(uint8(job.status), uint8(OracleJob.JobStatus.DISPUTED));
    }

    function test_dispute_emits_event() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.prank(disputer);
        vm.expectEmit(true, true, false, false);
        emit OracleJob.JobDisputed(jobId, disputer);
        jobContract.dispute(jobId);
    }

    function test_dispute_reverts_window_closed() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.warp(block.timestamp + jobContract.DISPUTE_WINDOW() + 1);
        vm.expectRevert(OracleJob.DisputeWindowClosed.selector);
        jobContract.dispute(jobId);
    }

    function test_dispute_reverts_already_disputed() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.prank(disputer);
        jobContract.dispute(jobId);
        vm.prank(rogue);
        vm.expectRevert(OracleJob.AlreadyDisputed.selector);
        jobContract.dispute(jobId);
    }

    function test_dispute_reverts_not_submitted() public {
        uint256 jobId = _createAndAccept();
        vm.expectRevert(OracleJob.JobNotSubmitted.selector);
        jobContract.dispute(jobId);
    }

    function test_finalise_reverts_if_disputed() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.prank(disputer);
        jobContract.dispute(jobId);
        vm.warp(block.timestamp + jobContract.DISPUTE_WINDOW() + 1);
        vm.expectRevert(OracleJob.JobNotSubmitted.selector);
        jobContract.finalise(jobId);
    }

     
    // uphold
     

    function test_uphold() public {
        uint256 jobId = _createAcceptSubmitAndDispute();

        uint256 oracleBefore = usdc.balanceOf(oracle);
        vm.prank(owner);
        jobContract.uphold(jobId);

        // Oracle gets fee + bond
        assertEq(usdc.balanceOf(oracle), oracleBefore + FEE + BOND);

        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(uint8(job.status), uint8(OracleJob.JobStatus.FINALISED));

        assertTrue(market.resolved());
        assertFalse(jobContract.hasActiveJob(address(market)));
    }

    function test_uphold_emits_events() public {
        uint256 jobId = _createAcceptSubmitAndDispute();
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit OracleJob.JobUpheld(jobId, oracle);
        jobContract.uphold(jobId);
    }

    function test_uphold_reverts_not_owner() public {
        uint256 jobId = _createAcceptSubmitAndDispute();
        vm.prank(rogue);
        vm.expectRevert();
        jobContract.uphold(jobId);
    }

    function test_uphold_reverts_not_disputed() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.prank(owner);
        vm.expectRevert(OracleJob.JobNotDisputed.selector);
        jobContract.uphold(jobId);
    }

     
    // overturn
     

    function test_overturn() public {
        uint256 jobId = _createAcceptSubmitAndDispute();

        uint256 treasuryBefore  = usdc.balanceOf(treasury);
        uint256 requesterBefore = usdc.balanceOf(requester);

        vm.prank(owner);
        jobContract.overturn(jobId, Market.Outcome.NO);

        // Bond slashed to treasury
        assertEq(usdc.balanceOf(treasury),  treasuryBefore  + BOND);
        // Fee refunded to requester
        assertEq(usdc.balanceOf(requester), requesterBefore + FEE);

        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(uint8(job.status),  uint8(OracleJob.JobStatus.OVERTURNED));
        assertEq(uint8(job.outcome), uint8(Market.Outcome.NO));
        assertEq(job.bond, 0);
        assertEq(job.fee,  0);

        // Market resolved with corrected outcome
        assertTrue(market.resolved());
        assertEq(uint8(market.outcome()), uint8(Market.Outcome.NO));

        assertFalse(jobContract.hasActiveJob(address(market)));
    }

    function test_overturn_emits_event() public {
        uint256 jobId = _createAcceptSubmitAndDispute();
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit OracleJob.JobOverturned(jobId, Market.Outcome.NO, BOND);
        jobContract.overturn(jobId, Market.Outcome.NO);
    }

    function test_overturn_reverts_not_owner() public {
        uint256 jobId = _createAcceptSubmitAndDispute();
        vm.prank(rogue);
        vm.expectRevert();
        jobContract.overturn(jobId, Market.Outcome.NO);
    }

    function test_overturn_reverts_unresolved_outcome() public {
        uint256 jobId = _createAcceptSubmitAndDispute();
        vm.prank(owner);
        vm.expectRevert(OracleJob.InvalidOutcome.selector);
        jobContract.overturn(jobId, Market.Outcome.UNRESOLVED);
    }

    function test_overturn_reverts_not_disputed() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.prank(owner);
        vm.expectRevert(OracleJob.JobNotDisputed.selector);
        jobContract.overturn(jobId, Market.Outcome.NO);
    }

     
    // expiry
     

    function test_expire_job_refunds_fee() public {
        uint256 jobId = _createJob();
        vm.warp(block.timestamp + jobContract.ACCEPT_DEADLINE() + 1);

        uint256 requesterBefore = usdc.balanceOf(requester);
        jobContract.expireJob(jobId);

        assertEq(usdc.balanceOf(requester), requesterBefore + FEE);

        OracleJob.Job memory job = jobContract.getJob(jobId);
        assertEq(uint8(job.status), uint8(OracleJob.JobStatus.EXPIRED));
        assertFalse(jobContract.hasActiveJob(address(market)));
    }

    function test_expire_job_emits_event() public {
        uint256 jobId = _createJob();
        vm.warp(block.timestamp + jobContract.ACCEPT_DEADLINE() + 1);
        vm.expectEmit(true, true, false, true);
        emit OracleJob.JobExpired(jobId, requester, FEE);
        jobContract.expireJob(jobId);
    }

    function test_expire_job_reverts_deadline_not_passed() public {
        uint256 jobId = _createJob();
        vm.expectRevert(OracleJob.DeadlineNotPassed.selector);
        jobContract.expireJob(jobId);
    }

    function test_expire_job_reverts_not_open() public {
        uint256 jobId = _createAndAccept();
        vm.warp(block.timestamp + jobContract.ACCEPT_DEADLINE() + 1);
        vm.expectRevert(OracleJob.JobNotOpen.selector);
        jobContract.expireJob(jobId);
    }

     
    // Admin
     

    function test_set_oracle() public {
        address newOracle = makeAddr("newOracle");
        vm.prank(owner);
        jobContract.setOracle(newOracle, true);
        assertTrue(jobContract.authorisedOracles(newOracle));
    }

    function test_deauthorise_oracle() public {
        vm.prank(owner);
        jobContract.setOracle(oracle, false);
        assertFalse(jobContract.authorisedOracles(oracle));
    }

    function test_set_oracle_reverts_not_owner() public {
        vm.prank(rogue);
        vm.expectRevert();
        jobContract.setOracle(makeAddr("x"), true);
    }

    function test_set_treasury() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        jobContract.setTreasury(newTreasury);
        assertEq(jobContract.treasury(), newTreasury);
    }

    function test_set_treasury_reverts_zero() public {
        vm.prank(owner);
        vm.expectRevert(OracleJob.InvalidAddress.selector);
        jobContract.setTreasury(address(0));
    }

     
    // Views
     

    function test_in_dispute_window_true() public {
        uint256 jobId = _createAcceptAndSubmit();
        assertTrue(jobContract.inDisputeWindow(jobId));
    }

    function test_in_dispute_window_false_after_expiry() public {
        uint256 jobId = _createAcceptAndSubmit();
        vm.warp(block.timestamp + jobContract.DISPUTE_WINDOW() + 1);
        assertFalse(jobContract.inDisputeWindow(jobId));
    }

    function test_is_expired_true() public {
        uint256 jobId = _createJob();
        vm.warp(block.timestamp + jobContract.ACCEPT_DEADLINE() + 1);
        assertTrue(jobContract.isExpired(jobId));
    }

    function test_is_expired_false_before_deadline() public {
        uint256 jobId = _createJob();
        assertFalse(jobContract.isExpired(jobId));
    }

     
    // Fuzz Tests
     

    /// @notice Fuzz: any valid outcome can be submitted and finalised
    function testFuzz_full_happy_path(uint8 outcomeInt) public {
        outcomeInt = uint8(bound(outcomeInt, 1, 3)); // YES=1 NO=2 INVALID=3
        Market.Outcome outcome = Market.Outcome(outcomeInt);

        uint256 jobId = _createAndAccept();

        vm.prank(oracle);
        jobContract.submitOutcome(jobId, outcome, "ipfs://fuzz");

        vm.warp(block.timestamp + jobContract.DISPUTE_WINDOW() + 1);
        jobContract.finalise(jobId);

        assertEq(uint8(market.outcome()), outcomeInt);
        assertEq(uint8(jobContract.getJob(jobId).status), uint8(OracleJob.JobStatus.FINALISED));
    }

    /// @notice Fuzz: overturn always resolves with new outcome, not original
    function testFuzz_overturn_uses_new_outcome(uint8 newOutcomeInt) public {
        newOutcomeInt = uint8(bound(newOutcomeInt, 1, 3));
        Market.Outcome newOutcome = Market.Outcome(newOutcomeInt);

        uint256 jobId = _createAcceptSubmitAndDispute();

        vm.prank(owner);
        jobContract.overturn(jobId, newOutcome);

        assertEq(uint8(market.outcome()), newOutcomeInt);
    }

     
    // Helpers
     

    function _createJob() internal returns (uint256 jobId) {
        vm.prank(requester);
        jobId = jobContract.createJob(address(market));
    }

    function _createAndAccept() internal returns (uint256 jobId) {
        jobId = _createJob();
        vm.prank(oracle);
        jobContract.acceptJob(jobId);
    }

    function _createAcceptAndSubmit() internal returns (uint256 jobId) {
        jobId = _createAndAccept();
        vm.prank(oracle);
        jobContract.submitOutcome(jobId, Market.Outcome.YES, "ipfs://evidence");
    }

    function _createAcceptSubmitAndDispute() internal returns (uint256 jobId) {
        jobId = _createAcceptAndSubmit();
        vm.prank(disputer);
        jobContract.dispute(jobId);
    }
}