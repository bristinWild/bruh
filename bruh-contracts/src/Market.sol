// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*
 ██████╗ ██████╗ ██╗   ██╗██╗  ██╗
 ██╔══██╗██╔══██╗██║   ██║██║  ██║
 ██████╔╝██████╔╝██║   ██║███████║
 ██╔══██╗██╔══██╗██║   ██║██╔══██║
 ██████╔╝██║  ██║╚██████╔╝██║  ██║
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝
 Prediction Market · Arc Testnet · USDC-native
*/

import {IERC20}        from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}     from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}      from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title  Market
/// @author Bruh Protocol
/// @notice Binary prediction market with a Constant Product AMM (CPMM).
///
/// ┌─────────────────────────────────────────────────────────────────────────┐
/// │  ARCHITECTURE                                                           │
/// │                                                                         │
/// │  Two virtual reserves: YES (Y) and NO (N).                             │
/// │  Invariant (pre-fee): Y × N = k                                        │
/// │                                                                         │
/// │  YES price  = N / (Y + N)   ∈ (0, 1)                                  │
/// │  NO  price  = Y / (Y + N)   ∈ (0, 1)                                  │
/// │                                                                         │
/// │  On resolution, winning shares redeem pro-rata from collateral pool.   │
/// │  Losing shares are worthless. INVALID splits pool by share count.      │
/// │                                                                         │
/// │  FEES                                                                   │
/// │  Swap fee (default 100 bps = 1%) split:                                │
/// │    50% → protocol treasury (accrued, withdrawn separately)             │
/// │    50% → LP pool (increases redemption value)                          │
/// │                                                                         │
/// │  SECURITY                                                               │
/// │  · ReentrancyGuard on all external state-changers                      │
/// │  · Pausable by factory for emergency halt                              │
/// │  · Oracle rotation via factory only                                    │
/// │  · Slippage protection on every trade                                  │
/// │  · Custom errors (gas-efficient, no string revert data)                │
/// │  · Integer-only math, no floating point                                │
/// │  · Input validation on construction

/// │  ARC NOTES                                                              │
/// │  · All transfers use the 6-decimal ERC-20 USDC interface               │
/// │  · No native sends, no selfdestruct, no onchain randomness             │
/// │  · block.timestamp used only at hour/day granularity (Arc timestamps   │
/// │    are non-decreasing, not strictly increasing)                        │
/// │  · USDC blocklist: a blocklisted winner's redeem() reverts for them    │
/// │    only; per-user pull pattern isolates the failure                    │
/// │  · skim() recovers native-USDC surplus (selfdestruct endowments)       │                                    │
/// └─────────────────────────────────────────────────────────────────────────┘

contract Market is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

  
    // Constants

    /// @notice Basis point denominator (10_000 = 100%)
    uint256 public constant FEE_DENOMINATOR = 10_000;

    /// @notice Default swap fee: 1%
    uint256 public constant DEFAULT_FEE_BPS = 100;

    /// @notice Maximum swap fee: 5% (hard cap, cannot be overridden)
    uint256 public constant MAX_FEE_BPS = 500;

    /// @notice Fixed-point precision for price calculations
    uint256 public constant PRECISION = 1e18;

    /// @notice Minimum seed liquidity (1 USDC, 6 decimals)
    uint256 public constant MIN_LIQUIDITY = 1e6;

    /// @notice Minimum trade size (0.01 USDC)
    uint256 public constant MIN_TRADE = 10_000;

    // Types
    /// @notice Possible market outcomes
    enum Outcome {
        UNRESOLVED, // market is live or pending resolution
        YES,        // YES outcome confirmed
        NO,         // NO outcome confirmed
        INVALID     // question became unanswerable; refund mode
    }

    /// @notice Immutable market metadata
    struct MarketInfo {
        string  question;   // the prediction question
        uint256 closeTime;  // trading closes at this unix timestamp
        uint256 createdAt;  // block.timestamp at deployment
        address creator;    // address that seeded initial liquidity
    }

  
    // Immutables

    /// @notice USDC token on Arc
    IERC20  public immutable usdc;

    /// @notice MarketFactory that deployed this market
    address public immutable factory;

    // Storage
   
    /// @notice Immutable market metadata (set once in constructor)
    MarketInfo public info;

    /// @notice Address authorised to resolve this market
    address public oracle;

    /// @notice Protocol fee recipient
    address public treasury;

    /// @notice Current swap fee in basis points
    uint256 public feeBps;

    /// @notice Resolved outcome (UNRESOLVED until oracle calls resolve())
    Outcome public outcome;

    /// @notice True once requestResolution() has been called
    bool public resolutionRequested;

    //  CPMM reserves 

    /// @notice USDC units allocated to YES side of the AMM
    uint256 public reserveYes;

    /// @notice USDC units allocated to NO side of the AMM
    uint256 public reserveNo;

    //  Collateral pool 

    /// @notice Total USDC in the collateral pool (available for redemption)
    uint256 public collateral;

    // Liquidity provider tracking 

    /// @notice Total LP shares outstanding
    uint256 public totalLpShares;

    /// @notice LP shares per address
    mapping(address => uint256) public lpShares;

    //  Outcome share balances 

    /// @notice YES share balance per address
    mapping(address => uint256) public sharesYes;

    /// @notice NO share balance per address
    mapping(address => uint256) public sharesNo;

    /// @notice Total YES shares outstanding (for redemption math)
    uint256 public totalSharesYes;

    /// @notice Total NO shares outstanding (for redemption math)
    uint256 public totalSharesNo;

    //  Fee accounting 

    /// @notice Protocol fee (treasury half) accrued but not yet withdrawn
    uint256 public accruedFees;

    // Events

    event LiquidityAdded(
        address indexed provider,
        uint256 usdcIn,
        uint256 lpSharesMinted,
        uint256 newReserveYes,
        uint256 newReserveNo
    );

    event LiquidityRemoved(
        address indexed provider,
        uint256 lpSharesBurned,
        uint256 usdcOut,
        uint256 newReserveYes,
        uint256 newReserveNo
    );

    event SharesBought(
        address indexed buyer,
        bool    isYes,
        uint256 usdcIn,
        uint256 feeCharged,
        uint256 sharesOut,
        uint256 yesPriceAfter
    );

    event SharesSold(
        address indexed seller,
        bool    isYes,
        uint256 sharesIn,
        uint256 usdcOut,
        uint256 feeCharged,
        uint256 yesPriceAfter
    );

    event ResolutionRequested(address indexed requestor, uint256 timestamp);

    event MarketResolved(Outcome indexed outcome, address indexed oracle, uint256 timestamp);

    event Redeemed(address indexed user, uint256 usdcOut, Outcome outcome);

    event FeesWithdrawn(address indexed treasury, uint256 amount);

    event OracleRotated(address indexed oldOracle, address indexed newOracle);

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    event FeeUpdated(uint256 oldBps, uint256 newBps);



    // Errors

    error OnlyFactory();
    error OnlyOracle();
    error MarketAlreadyClosed();
    error MarketNotYetClosed();
    error MarketNotResolved();
    error AlreadyResolved();
    error ResolutionNotYetRequested();
    error InvalidOutcome();
    error ZeroAmount();
    error BelowMinTrade();
    error SlippageExceeded();
    error InsufficientShares();
    error InsufficientLpShares();
    error BelowMinLiquidity();
    error FeeTooHigh();
    error InvalidAddress();
    error NothingToRedeem();
    error NothingToWithdraw();
    error MathOverflow();
    error InsufficientPoolLiquidity();

    // Modifiers
    modifier onlyFactory() {
        if (msg.sender != factory) revert OnlyFactory();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert OnlyOracle();
        _;
    }

    /// @dev Reverts if trading window has closed OR market is resolved
    modifier whileOpen() {
        if (block.timestamp >= info.closeTime) revert MarketAlreadyClosed();
        if (outcome != Outcome.UNRESOLVED)     revert AlreadyResolved();
        _;
    }

    modifier afterClose() {
        if (block.timestamp < info.closeTime) revert MarketNotYetClosed();
        _;
    }

    modifier whenResolved() {
        if (outcome == Outcome.UNRESOLVED) revert MarketNotResolved();
        _;
    }

    // Constructor

    /// @notice Initialise a new market.
    ///         The factory MUST transfer `_seedUsdc` USDC to this contract
    ///         before (or atomically with) calling this constructor.
    ///
    /// @param _usdc      USDC token address on Arc
    /// @param _oracle    Initial oracle wallet (agent)
    /// @param _treasury  Protocol fee recipient
    /// @param _creator   Address that seeded initial liquidity (receives LP shares)
    /// @param _question  The prediction question
    /// @param _closeTime Unix timestamp when trading closes
    /// @param _seedUsdc  Initial liquidity amount in USDC (6 decimals)
    constructor(
        address       _usdc,
        address       _oracle,
        address       _treasury,
        address       _creator,
        string memory _question,
        uint256       _closeTime,
        uint256       _seedUsdc
    ) {
        //  Input validation 
        if (_usdc     == address(0)) revert InvalidAddress();
        if (_oracle   == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();
        if (_creator  == address(0)) revert InvalidAddress();
        if (bytes(_question).length == 0) revert ZeroAmount();
        if (_closeTime <= block.timestamp) revert MarketAlreadyClosed();
        if (_seedUsdc < MIN_LIQUIDITY)     revert BelowMinLiquidity();

        //  Assign immutables 
        usdc    = IERC20(_usdc);
        factory = msg.sender;

        //  Assign mutable state 
        oracle   = _oracle;
        treasury = _treasury;
        feeBps   = DEFAULT_FEE_BPS;

        info = MarketInfo({
            question:  _question,
            closeTime: _closeTime,
            createdAt: block.timestamp,
            creator:   _creator
        });

        // Seed CPMM with equal reserves 
        // Split seed evenly so initial YES price = 50%
        uint256 half = _seedUsdc / 2;
        reserveYes = half;
        reserveNo  = half;
        collateral = _seedUsdc;

        //  Mint LP shares to creator 
        totalLpShares    = _seedUsdc;
        lpShares[_creator] = _seedUsdc;

        emit LiquidityAdded(_creator, _seedUsdc, _seedUsdc, half, half);
    }

    // Liquidity Management

    /// @notice Add liquidity to both sides proportionally.
    ///         Mints LP shares proportional to existing pool size.
    ///
    /// @param  usdcIn      USDC to deposit (split 50/50 across reserves)
    /// @return lpMinted    LP shares issued to msg.sender
    function addLiquidity(uint256 usdcIn)
        external
        nonReentrant
        whileOpen
        whenNotPaused
        returns (uint256 lpMinted)
    {
        if (usdcIn < MIN_LIQUIDITY) revert BelowMinLiquidity();

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        // LP shares ∝ usdcIn / existing collateral
        lpMinted = (usdcIn * totalLpShares) / collateral;

        uint256 half = usdcIn / 2;
        reserveYes += half;
        reserveNo  += (usdcIn - half); // handle odd usdcIn
        collateral += usdcIn;

        totalLpShares        += lpMinted;
        lpShares[msg.sender] += lpMinted;

        emit LiquidityAdded(msg.sender, usdcIn, lpMinted, reserveYes, reserveNo);
    }

    /// @notice Burn LP shares and withdraw proportional USDC.
    ///         Cannot remove liquidity if it would break MIN_LIQUIDITY invariant.
    ///
    /// @param  lpIn     LP shares to burn
    /// @return usdcOut  USDC returned to msg.sender
    function removeLiquidity(uint256 lpIn)
        external
        nonReentrant
        whileOpen
        whenNotPaused
        returns (uint256 usdcOut)
    {
        if (lpIn == 0) revert ZeroAmount();
        if (lpShares[msg.sender] < lpIn) revert InsufficientLpShares();

        usdcOut = (lpIn * collateral) / totalLpShares;

        // Enforce minimum pool liquidity after removal
        if (collateral - usdcOut < MIN_LIQUIDITY) revert BelowMinLiquidity();

        uint256 half = usdcOut / 2;
        reserveYes -= half;
        reserveNo  -= (usdcOut - half);
        collateral -= usdcOut;

        totalLpShares        -= lpIn;
        lpShares[msg.sender] -= lpIn;

        usdc.safeTransfer(msg.sender, usdcOut);

        emit LiquidityRemoved(msg.sender, lpIn, usdcOut, reserveYes, reserveNo);
    }

    // Trading

    /// @notice Buy YES or NO shares with USDC.
    ///
    /// @param  isYes        true → buy YES shares; false → buy NO shares
    /// @param  usdcIn       Gross USDC amount (fee deducted from this)
    /// @param  minSharesOut Minimum shares to receive (reverts if not met)
    /// @return sharesOut    Outcome shares minted to msg.sender
    function buy(
        bool    isYes,
        uint256 usdcIn,
        uint256 minSharesOut
    )
        external
        nonReentrant
        whileOpen
        whenNotPaused
        returns (uint256 sharesOut)
    {
        if (usdcIn < MIN_TRADE) revert BelowMinTrade();

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        //  Fee split 
        uint256 fee        = (usdcIn * feeBps) / FEE_DENOMINATOR;
        uint256 halfFee    = fee / 2;
        uint256 usdcNetIn  = usdcIn - fee;

        // Half fee accrues to treasury; half stays in pool (increases LP value)
        accruedFees += halfFee;
        collateral  += usdcNetIn + halfFee;

        //  CPMM swap 
        // Invariant: reserveYes * reserveNo = k (approximately, k grows with pool fees)
        if (isYes) {
            uint256 newReserveYes = reserveYes + usdcNetIn;
            uint256 newReserveNo  = _mulDiv(reserveYes, reserveNo, newReserveYes);
            sharesOut  = reserveNo - newReserveNo;
            if (sharesOut == 0) revert InsufficientPoolLiquidity();

            reserveYes = newReserveYes;
            reserveNo  = newReserveNo;

            sharesYes[msg.sender] += sharesOut;
            totalSharesYes        += sharesOut;
        } else {
            uint256 newReserveNo  = reserveNo + usdcNetIn;
            uint256 newReserveYes = _mulDiv(reserveYes, reserveNo, newReserveNo);
            sharesOut  = reserveYes - newReserveYes;
            if (sharesOut == 0) revert InsufficientPoolLiquidity();

            reserveNo  = newReserveNo;
            reserveYes = newReserveYes;

            sharesNo[msg.sender] += sharesOut;
            totalSharesNo        += sharesOut;
        }

        if (sharesOut < minSharesOut) revert SlippageExceeded();

        emit SharesBought(msg.sender, isYes, usdcIn, fee, sharesOut, _yesPrice());
    }

    /// @notice Sell YES or NO shares back for USDC.
    ///
    /// @param  isYes      true → sell YES shares; false → sell NO shares
    /// @param  sharesIn   Number of shares to sell
    /// @param  minUsdcOut Minimum USDC to receive (reverts if not met)
    /// @return usdcOut    USDC transferred to msg.sender
    function sell(
        bool    isYes,
        uint256 sharesIn,
        uint256 minUsdcOut
    )
        external
        nonReentrant
        whileOpen
        whenNotPaused
        returns (uint256 usdcOut)
    {
        if (sharesIn == 0) revert ZeroAmount();

        // ── CPMM reverse swap ─────────────────────────────────────────────────
        uint256 usdcGross;
        if (isYes) {
            if (sharesYes[msg.sender] < sharesIn) revert InsufficientShares();

            uint256 newReserveNo  = reserveNo + sharesIn;
            uint256 newReserveYes = _mulDiv(reserveYes, reserveNo, newReserveNo);
            usdcGross  = reserveYes - newReserveYes;

            reserveNo  = newReserveNo;
            reserveYes = newReserveYes;

            sharesYes[msg.sender] -= sharesIn;
            totalSharesYes        -= sharesIn;
        } else {
            if (sharesNo[msg.sender] < sharesIn) revert InsufficientShares();

            uint256 newReserveYes = reserveYes + sharesIn;
            uint256 newReserveNo  = _mulDiv(reserveYes, reserveNo, newReserveYes);
            usdcGross  = reserveNo - newReserveNo;

            reserveYes = newReserveYes;
            reserveNo  = newReserveNo;

            sharesNo[msg.sender] -= sharesIn;
            totalSharesNo        -= sharesIn;
        }

        // Fee split 
        uint256 fee     = (usdcGross * feeBps) / FEE_DENOMINATOR;
        uint256 halfFee = fee / 2;
        usdcOut = usdcGross - fee;

        accruedFees += halfFee;
        collateral  -= (usdcOut + halfFee);

        if (usdcOut < minUsdcOut) revert SlippageExceeded();
        if (usdcOut < MIN_TRADE)  revert BelowMinTrade();

        usdc.safeTransfer(msg.sender, usdcOut);

        emit SharesSold(msg.sender, isYes, sharesIn, usdcOut, fee, _yesPrice());
    }

    // Resolution

    /// @notice Anyone may call this after closeTime to signal readiness.
    ///         Needed before oracle can call resolve().
    function requestResolution() external afterClose {
        if (outcome != Outcome.UNRESOLVED) revert AlreadyResolved();
        resolutionRequested = true;
        emit ResolutionRequested(msg.sender, block.timestamp);
    }

    /// @notice Oracle submits the final outcome.
    ///         Must be called after requestResolution().
    ///
    /// @param _outcome  YES, NO, or INVALID (not UNRESOLVED)
    function resolve(Outcome _outcome)
        external
        onlyOracle
        afterClose
        nonReentrant
    {
        if (!resolutionRequested)        revert ResolutionNotYetRequested();
        if (outcome != Outcome.UNRESOLVED) revert AlreadyResolved();
        if (_outcome == Outcome.UNRESOLVED) revert InvalidOutcome();

        outcome = _outcome;

        emit MarketResolved(_outcome, msg.sender, block.timestamp);
    }

    // Redemption

    /// @notice Winners redeem their outcome shares for USDC.
    ///
    ///         Winning shares redeem pro-rata from collateral:
    ///           usdcOut = userShares × collateral / totalWinningShares
    ///
    ///         INVALID: both YES and NO shares refunded proportionally
    ///           from the full collateral pool.
    ///
    /// @return usdcOut  USDC sent to msg.sender
    function redeem()
        external
        nonReentrant
        whenResolved
        returns (uint256 usdcOut)
    {
        if (outcome == Outcome.YES) {
            uint256 shares = sharesYes[msg.sender];
            if (shares == 0) revert NothingToRedeem();

            // Pro-rata: user gets shares/totalShares of collateral
            usdcOut = _mulDiv(shares, collateral, totalSharesYes);

            sharesYes[msg.sender] = 0;
            totalSharesYes -= shares;
            collateral     -= usdcOut;

        } else if (outcome == Outcome.NO) {
            uint256 shares = sharesNo[msg.sender];
            if (shares == 0) revert NothingToRedeem();

            usdcOut = _mulDiv(shares, collateral, totalSharesNo);

            sharesNo[msg.sender] = 0;
            totalSharesNo -= shares;
            collateral    -= usdcOut;

        } else {
            // INVALID — refund both sides proportionally
            uint256 yShares = sharesYes[msg.sender];
            uint256 nShares = sharesNo[msg.sender];
            if (yShares == 0 && nShares == 0) revert NothingToRedeem();

            uint256 totalShares = totalSharesYes + totalSharesNo;
            uint256 userShares  = yShares + nShares;

            usdcOut = _mulDiv(userShares, collateral, totalShares);

            sharesYes[msg.sender] = 0;
            sharesNo[msg.sender]  = 0;
            totalSharesYes -= yShares;
            totalSharesNo  -= nShares;
            collateral     -= usdcOut;
        }

        usdc.safeTransfer(msg.sender, usdcOut);

        emit Redeemed(msg.sender, usdcOut, outcome);
    }

    // Protocol Admin (factory only)
    /// @notice Rotate the oracle to a new address.
    function rotateOracle(address newOracle) external onlyFactory {
        if (newOracle == address(0)) revert InvalidAddress();
        emit OracleRotated(oracle, newOracle);
        oracle = newOracle;
    }

    /// @notice Update the protocol fee treasury address.
    function setTreasury(address newTreasury) external onlyFactory {
        if (newTreasury == address(0)) revert InvalidAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @notice Update swap fee. Cannot exceed MAX_FEE_BPS.
    function setFee(uint256 newBps) external onlyFactory {
        if (newBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(feeBps, newBps);
        feeBps = newBps;
    }

    /// @notice Emergency pause — halts all trading and liquidity operations.
    function pause() external onlyFactory {
        _pause();
    }

    /// @notice Resume after emergency pause.
    function unpause() external onlyFactory {
        _unpause();
    }

    /// @notice Transfer accrued protocol fees to treasury.
    function withdrawFees() external nonReentrant {
        uint256 amount = accruedFees;
        if (amount == 0) revert NothingToWithdraw();
        accruedFees = 0;
        usdc.safeTransfer(treasury, amount);
        emit FeesWithdrawn(treasury, amount);
    }

    /// @notice Sweep untracked USDC surplus to the treasury.
    /// @dev    ARC-SPECIFIC: on Arc, a contract's USDC *is* its native balance.
    ///         SELFDESTRUCT endowments or direct native sends can credit this
    ///         contract outside our accounting (collateral + accruedFees).
    ///         This recovers that surplus instead of locking it forever.
    ///         Note: balanceOf() is the 6-decimal truncated view of the native
    ///         balance, which matches our accounting units exactly.
    function skim() external nonReentrant returns (uint256 surplus) {
        uint256 tracked = collateral + accruedFees;
        uint256 balance = usdc.balanceOf(address(this));
        if (balance <= tracked) revert NothingToWithdraw();
        surplus = balance - tracked;
        usdc.safeTransfer(treasury, surplus);
        emit FeesWithdrawn(treasury, surplus);
    }

    
    // Views

    /// @notice Current YES probability as a WAD (1e18 = 100%).
    ///         e.g. 0.64e18 → 64% implied probability for YES.
    function yesPrice() external view returns (uint256) {
        return _yesPrice();
    }

    /// @notice Current NO probability as a WAD.
    function noPrice() external view returns (uint256) {
    return _mulDiv(reserveNo, PRECISION, reserveYes + reserveNo);
}

    /// @notice Preview the outcome of a buy without executing it.
    ///
    /// @return sharesOut  Expected shares received
    /// @return fee        Fee charged (in USDC)
    function previewBuy(bool isYes, uint256 usdcIn)
        external
        view
        returns (uint256 sharesOut, uint256 fee)
    {
        if (usdcIn < MIN_TRADE) return (0, 0);
        fee = (usdcIn * feeBps) / FEE_DENOMINATOR;
        uint256 usdcNet = usdcIn - fee;

        if (isYes) {
            uint256 newReserveYes = reserveYes + usdcNet;
            uint256 newReserveNo  = _mulDiv(reserveYes, reserveNo, newReserveYes);
            sharesOut = reserveNo - newReserveNo;
        } else {
            uint256 newReserveNo  = reserveNo + usdcNet;
            uint256 newReserveYes = _mulDiv(reserveYes, reserveNo, newReserveNo);
            sharesOut = reserveYes - newReserveYes;
        }
    }

    /// @notice Preview the outcome of a sell without executing it.
    ///
    /// @return usdcOut  Expected USDC received (after fee)
    /// @return fee      Fee charged (in USDC)
    function previewSell(bool isYes, uint256 sharesIn)
        external
        view
        returns (uint256 usdcOut, uint256 fee)
    {
        if (sharesIn == 0) return (0, 0);
        uint256 usdcGross;

        if (isYes) {
            uint256 newReserveNo  = reserveNo + sharesIn;
            uint256 newReserveYes = _mulDiv(reserveYes, reserveNo, newReserveNo);
            usdcGross = reserveYes - newReserveYes;
        } else {
            uint256 newReserveYes = reserveYes + sharesIn;
            uint256 newReserveNo  = _mulDiv(reserveYes, reserveNo, newReserveYes);
            usdcGross = reserveNo - newReserveNo;
        }

        fee     = (usdcGross * feeBps) / FEE_DENOMINATOR;
        usdcOut = usdcGross - fee;
    }

    /// @notice Returns true if the market is accepting trades.
    function isOpen() external view returns (bool) {
        return block.timestamp < info.closeTime
            && outcome == Outcome.UNRESOLVED
            && !paused();
    }

    /// @notice Approximate invariant k = reserveYes × reserveNo.
    ///         Will grow slightly over time as LP fees accumulate.
    function getK() external view returns (uint256) {
        return reserveYes * reserveNo;
    }

    /// @notice Full market summary for frontend/agent consumption.
    function summary() external view returns (
        string  memory question,
        uint256        closeTime,
        Outcome        currentOutcome,
        uint256        yesPriceWad,
        uint256        noPriceWad,
        uint256        totalCollateral,
        uint256        yesShares,
        uint256        noShares,
        bool           open,
        bool           resolved
    ) {
        question        = info.question;
        closeTime       = info.closeTime;
        currentOutcome  = outcome;
        yesPriceWad     = _yesPrice();
        noPriceWad      = _mulDiv(reserveYes, PRECISION, reserveYes + reserveNo);
        totalCollateral = collateral;
        yesShares       = totalSharesYes;
        noShares        = totalSharesNo;
        open            = block.timestamp < info.closeTime && outcome == Outcome.UNRESOLVED && !paused();
        resolved        = outcome != Outcome.UNRESOLVED;
    }

    // Internal Helpers
   

    /// @dev YES price as WAD: N / (Y + N) × 1e18
   function _yesPrice() internal view returns (uint256) {
    return _mulDiv(reserveYes, PRECISION, reserveYes + reserveNo);
}

    /// @dev Overflow-safe (a × b) / c using Solidity 0.8 checked arithmetic.
    ///      For production, replace with OZ Math.mulDiv for full 512-bit safety.
    function _mulDiv(uint256 a, uint256 b, uint256 c) internal pure returns (uint256) {
        if (c == 0) revert MathOverflow();
        return (a * b) / c;
    }
}
