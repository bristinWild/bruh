// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title  MarketLMSR
/// @author Bruh Protocol
/// @notice Binary prediction market using Hanson's Logarithmic Market Scoring Rule.
///
/// ┌─────────────────────────────────────────────────────────────────────────┐
/// │  LMSR                                                                   │
/// │                                                                         │
/// │  Cost function:  C(q) = b · ln( e^(qY/b) + e^(qN/b) )                  │
/// │  Buy Δ YES:      cost = C(qY+Δ, qN) − C(qY, qN)                        │
/// │  YES price:      e^(qY/b) / ( e^(qY/b) + e^(qN/b) )   ∈ (0,1)         │
/// │                                                                         │
/// │  Winning shares redeem 1:1 for USDC.                                   │
/// │  Sponsor max loss is bounded: b · ln(2).                               │
/// │  Constructor therefore REQUIRES seed ≥ b·ln(2) → always solvent.       │
/// │                                                                         │
/// │  NUMERICS                                                               │
/// │  All internal math in WAD (1e18). USDC I/O in 6 decimals.             │
/// │  log-sum-exp trick keeps exponents ≤ 0 → wadExp never overflows.      │
/// │  Buys round cost UP, sells round refund DOWN (protocol-favoring).      │
/// │                                                                         │
/// │  ARC NOTES (same as Market.sol)                                        │
/// │  · ERC-20 USDC interface only (6 decimals), no native sends            │
/// │  · Per-user pull redemption isolates blocklisted addresses             │
/// │  · skim() recovers forced native-USDC endowments                       │
/// │  · timestamps used only at hour/day granularity                        │
/// └─────────────────────────────────────────────────────────────────────────┘

contract MarketLMSR is ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    
    // Constants
    

    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant DEFAULT_FEE_BPS = 100;   // 1%
    uint256 public constant MAX_FEE_BPS     = 500;   // 5%
    int256  public constant WAD             = 1e18;
    uint256 public constant USDC_TO_WAD     = 1e12;  // 6dp → 18dp
    int256  public constant LN2_WAD         = 693147180559945309; // ln(2)·1e18
    uint256 public constant MIN_SHARES      = 1e16;  // 0.01 share (WAD)

    
    // Types
    

    enum Outcome { UNRESOLVED, YES, NO, INVALID }

    struct MarketInfo {
        string  question;
        uint256 closeTime;
        uint256 createdAt;
        address creator;
    }

    
    // Immutables / storage
    

    IERC20  public immutable usdc;
    address public immutable factory;

    MarketInfo public info;

    address public oracle;
    address public treasury;
    uint256 public feeBps;

    Outcome public outcome;
    bool    public resolutionRequested;

    /// @notice LMSR liquidity parameter b (WAD). Higher b = deeper market.
    int256 public immutable b;

    /// @notice Outstanding shares per side (WAD)
    int256 public qYes;
    int256 public qNo;

    /// @notice USDC (6dp) held for redemptions
    uint256 public collateral;

    /// @notice Treasury-half of fees accrued (6dp)
    uint256 public accruedFees;

    mapping(address => uint256) public sharesYes; // WAD
    mapping(address => uint256) public sharesNo;  // WAD
    uint256 public totalSharesYes;                // WAD
    uint256 public totalSharesNo;                 // WAD

    
    // Events / errors (parity with Market.sol naming)
    

    event SharesBought(address indexed buyer, bool isYes, uint256 usdcIn, uint256 fee, uint256 sharesOut, uint256 yesPriceAfter);
    event SharesSold(address indexed seller, bool isYes, uint256 sharesIn, uint256 usdcOut, uint256 fee, uint256 yesPriceAfter);
    event ResolutionRequested(address indexed requestor, uint256 timestamp);
    event MarketResolved(Outcome indexed outcome, address indexed oracle, uint256 timestamp);
    event Redeemed(address indexed user, uint256 usdcOut, Outcome outcome);
    event FeesWithdrawn(address indexed treasury, uint256 amount);
    event OracleRotated(address indexed oldOracle, address indexed newOracle);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event FeeUpdated(uint256 oldBps, uint256 newBps);
    event Skimmed(address indexed treasury, uint256 amount);

    error OnlyFactory();
    error OnlyOracle();
    error MarketAlreadyClosed();
    error MarketNotYetClosed();
    error MarketNotResolved();
    error AlreadyResolved();
    error ResolutionNotYetRequested();
    error InvalidOutcome();
    error ZeroAmount();
    error BelowMinShares();
    error SlippageExceeded();
    error InsufficientShares();
    error InsufficientSeed();
    error FeeTooHigh();
    error InvalidAddress();
    error NothingToRedeem();
    error NothingToWithdraw();
    error NothingToSkim();
    error MathBounds();

    
    // Modifiers (identical semantics to Market.sol)
    

    modifier onlyFactory() { if (msg.sender != factory) revert OnlyFactory(); _; }
    modifier onlyOracle()  { if (msg.sender != oracle)  revert OnlyOracle();  _; }

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
    

    /// @param _b        LMSR liquidity parameter in WAD (e.g. 50e18)
    /// @param _seedUsdc Sponsor subsidy (6dp). MUST cover b·ln(2) max loss.
    constructor(
        address       _usdc,
        address       _oracle,
        address       _treasury,
        address       _creator,
        string memory _question,
        uint256       _closeTime,
        int256        _b,
        uint256       _seedUsdc
    ) {
        if (_usdc     == address(0)) revert InvalidAddress();
        if (_oracle   == address(0)) revert InvalidAddress();
        if (_treasury == address(0)) revert InvalidAddress();
        if (_creator  == address(0)) revert InvalidAddress();
        if (bytes(_question).length == 0) revert ZeroAmount();
        if (_closeTime <= block.timestamp) revert MarketAlreadyClosed();
        if (_b <= 0) revert MathBounds();

        // Max sponsor loss = b·ln(2). Seed must cover it → market always solvent.
        uint256 maxLossWad  = uint256((_b * LN2_WAD) / WAD);
        uint256 maxLossUsdc = _ceilWadToUsdc(maxLossWad);
        if (_seedUsdc < maxLossUsdc) revert InsufficientSeed();

        usdc     = IERC20(_usdc);
        factory  = msg.sender;
        oracle   = _oracle;
        treasury = _treasury;
        feeBps   = DEFAULT_FEE_BPS;
        b        = _b;

        info = MarketInfo(_question, _closeTime, block.timestamp, _creator);

        collateral = _seedUsdc; // factory transfers seed before/with construction
    }

    
    // Trading  NOTE: LMSR quotes by SHARES, not USDC-in
    

    /// @notice Buy an exact number of outcome shares.
    /// @param  isYes      true = YES, false = NO
    /// @param  sharesOut  shares to buy (WAD)
    /// @param  maxUsdcIn  slippage cap on total cost incl. fee (6dp)
    /// @return usdcIn     actual USDC charged incl. fee (6dp)
    function buy(bool isYes, uint256 sharesOut, uint256 maxUsdcIn)
        external
        nonReentrant
        whileOpen
        whenNotPaused
        returns (uint256 usdcIn)
    {
        if (sharesOut < MIN_SHARES) revert BelowMinShares();

        int256 dq = int256(sharesOut);
        uint256 costWad = _costDelta(
            isYes ? qYes + dq : qYes,
            isYes ? qNo       : qNo + dq
        );

        uint256 costUsdc = _ceilWadToUsdc(costWad); // round UP against buyer
        uint256 fee      = (costUsdc * feeBps) / FEE_DENOMINATOR;
        usdcIn = costUsdc + fee;

        if (usdcIn == 0)          revert ZeroAmount();
        if (usdcIn > maxUsdcIn)   revert SlippageExceeded();

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        uint256 halfFee = fee / 2;
        accruedFees += halfFee;
        collateral  += costUsdc + (fee - halfFee); // cost + pool-half of fee

        if (isYes) {
            qYes += dq;
            sharesYes[msg.sender] += sharesOut;
            totalSharesYes        += sharesOut;
        } else {
            qNo += dq;
            sharesNo[msg.sender] += sharesOut;
            totalSharesNo        += sharesOut;
        }

        emit SharesBought(msg.sender, isYes, usdcIn, fee, sharesOut, yesPrice());
    }

    /// @notice Sell an exact number of outcome shares back to the market.
    /// @param  minUsdcOut slippage floor on refund after fee (6dp)
    function sell(bool isYes, uint256 sharesIn, uint256 minUsdcOut)
        external
        nonReentrant
        whileOpen
        whenNotPaused
        returns (uint256 usdcOut)
    {
        if (sharesIn < MIN_SHARES) revert BelowMinShares();

        if (isYes) {
            if (sharesYes[msg.sender] < sharesIn) revert InsufficientShares();
        } else {
            if (sharesNo[msg.sender] < sharesIn) revert InsufficientShares();
        }

        int256 dq = int256(sharesIn);
        // Refund = C(q) − C(q − Δ)
        uint256 refundWad = _costDelta(
            isYes ? qYes - dq : qYes,
            isYes ? qNo       : qNo - dq
        );

        uint256 refundUsdc = _floorWadToUsdc(refundWad); // round DOWN against seller
        uint256 fee        = (refundUsdc * feeBps) / FEE_DENOMINATOR;
        usdcOut = refundUsdc - fee;

        if (usdcOut < minUsdcOut) revert SlippageExceeded();
        if (usdcOut == 0)         revert ZeroAmount();

        uint256 halfFee = fee / 2;
        accruedFees += halfFee;
        collateral  -= (usdcOut + halfFee);

        if (isYes) {
            qYes -= dq;
            sharesYes[msg.sender] -= sharesIn;
            totalSharesYes        -= sharesIn;
        } else {
            qNo -= dq;
            sharesNo[msg.sender] -= sharesIn;
            totalSharesNo        -= sharesIn;
        }

        usdc.safeTransfer(msg.sender, usdcOut);

        emit SharesSold(msg.sender, isYes, sharesIn, usdcOut, fee, yesPrice());
    }

    
    // Resolution / redemption (identical flow to Market.sol)
    

    function requestResolution() external afterClose {
        if (outcome != Outcome.UNRESOLVED) revert AlreadyResolved();
        resolutionRequested = true;
        emit ResolutionRequested(msg.sender, block.timestamp);
    }

    function resolve(Outcome _outcome) external onlyOracle afterClose nonReentrant {
        if (!resolutionRequested)          revert ResolutionNotYetRequested();
        if (outcome != Outcome.UNRESOLVED) revert AlreadyResolved();
        if (_outcome == Outcome.UNRESOLVED) revert InvalidOutcome();
        outcome = _outcome;
        emit MarketResolved(_outcome, msg.sender, block.timestamp);
    }

    /// @notice Winning shares redeem 1 share = 1 USDC (LMSR guarantee).
    ///         INVALID refunds pro-rata like the CPMM market.
    function redeem() external nonReentrant whenResolved returns (uint256 usdcOut) {
        if (outcome == Outcome.YES) {
            uint256 shares = sharesYes[msg.sender];
            if (shares == 0) revert NothingToRedeem();
            sharesYes[msg.sender] = 0;
            totalSharesYes -= shares;
            usdcOut = _floorWadToUsdc(shares); // 1 share (WAD) = 1 USDC
            collateral -= usdcOut;
        } else if (outcome == Outcome.NO) {
            uint256 shares = sharesNo[msg.sender];
            if (shares == 0) revert NothingToRedeem();
            sharesNo[msg.sender] = 0;
            totalSharesNo -= shares;
            usdcOut = _floorWadToUsdc(shares);
            collateral -= usdcOut;
        } else {
            uint256 y = sharesYes[msg.sender];
            uint256 n = sharesNo[msg.sender];
            if (y == 0 && n == 0) revert NothingToRedeem();
            uint256 totalShares = totalSharesYes + totalSharesNo;
            sharesYes[msg.sender] = 0;
            sharesNo[msg.sender]  = 0;
            totalSharesYes -= y;
            totalSharesNo  -= n;
            usdcOut = ((y + n) * collateral) / totalShares;
            collateral -= usdcOut;
        }

        usdc.safeTransfer(msg.sender, usdcOut);
        emit Redeemed(msg.sender, usdcOut, outcome);
    }

    
    // Admin (parity with Market.sol)
    

    function rotateOracle(address n) external onlyFactory { if (n == address(0)) revert InvalidAddress(); emit OracleRotated(oracle, n); oracle = n; }
    function setTreasury(address n)  external onlyFactory { if (n == address(0)) revert InvalidAddress(); emit TreasuryUpdated(treasury, n); treasury = n; }
    function setFee(uint256 nBps)    external onlyFactory { if (nBps > MAX_FEE_BPS) revert FeeTooHigh(); emit FeeUpdated(feeBps, nBps); feeBps = nBps; }
    function pause()   external onlyFactory { _pause(); }
    function unpause() external onlyFactory { _unpause(); }

    function withdrawFees() external nonReentrant {
        uint256 a = accruedFees;
        if (a == 0) revert NothingToWithdraw();
        accruedFees = 0;
        usdc.safeTransfer(treasury, a);
        emit FeesWithdrawn(treasury, a);
    }

    /// @notice ARC-SPECIFIC surplus sweep (forced native-USDC endowments).
    function skim() external nonReentrant returns (uint256 surplus) {
        uint256 tracked = collateral + accruedFees;
        uint256 bal = usdc.balanceOf(address(this));
        if (bal <= tracked) revert NothingToSkim();
        surplus = bal - tracked;
        usdc.safeTransfer(treasury, surplus);
        emit Skimmed(treasury, surplus);
    }

    
    // Views
    

    /// @notice YES probability in WAD via softmax(qY/b, qN/b).
    function yesPrice() public view returns (uint256) {
        // Subtract max exponent so both e^x ≤ 1 → no overflow.
        int256 xY = (qYes * WAD) / b;
        int256 xN = (qNo  * WAD) / b;
        int256 m  = xY > xN ? xY : xN;
        uint256 eY = uint256(wadExp(xY - m));
        uint256 eN = uint256(wadExp(xN - m));
        return (eY * uint256(WAD)) / (eY + eN);
    }

    function noPrice() external view returns (uint256) {
        return uint256(WAD) - yesPrice();
    }

    /// @notice Quote total USDC (incl. fee) to buy `sharesOut` shares.
    function previewBuy(bool isYes, uint256 sharesOut)
        external view returns (uint256 usdcIn, uint256 fee)
    {
        if (sharesOut < MIN_SHARES) return (0, 0);
        int256 dq = int256(sharesOut);
        uint256 costWad = _costDelta(
            isYes ? qYes + dq : qYes,
            isYes ? qNo       : qNo + dq
        );
        uint256 costUsdc = _ceilWadToUsdc(costWad);
        fee    = (costUsdc * feeBps) / FEE_DENOMINATOR;
        usdcIn = costUsdc + fee;
    }

    /// @notice Quote USDC refund (after fee) for selling `sharesIn`.
    function previewSell(bool isYes, uint256 sharesIn)
        external view returns (uint256 usdcOut, uint256 fee)
    {
        if (sharesIn < MIN_SHARES) return (0, 0);
        int256 dq = int256(sharesIn);
        uint256 refundWad = _costDelta(
            isYes ? qYes - dq : qYes,
            isYes ? qNo       : qNo - dq
        );
        uint256 refundUsdc = _floorWadToUsdc(refundWad);
        fee     = (refundUsdc * feeBps) / FEE_DENOMINATOR;
        usdcOut = refundUsdc - fee;
    }

    function isOpen() external view returns (bool) {
        return block.timestamp < info.closeTime && outcome == Outcome.UNRESOLVED && !paused();
    }

    function summary() external view returns (
        string memory question, uint256 closeTime, Outcome currentOutcome,
        uint256 yesPriceWad, uint256 noPriceWad, uint256 totalCollateral,
        uint256 yesShares, uint256 noShares, bool open, bool resolved
    ) {
        question        = info.question;
        closeTime       = info.closeTime;
        currentOutcome  = outcome;
        yesPriceWad     = yesPrice();
        noPriceWad      = uint256(WAD) - yesPriceWad;
        totalCollateral = collateral;
        yesShares       = totalSharesYes;
        noShares        = totalSharesNo;
        open            = block.timestamp < info.closeTime && outcome == Outcome.UNRESOLVED && !paused();
        resolved        = outcome != Outcome.UNRESOLVED;
    }

    
    // LMSR math internals
    

    /// @dev |C(newQ) − C(oldQ)| where oldQ is current (qYes,qNo). Positive WAD.
    ///      Callers arrange arguments so the delta direction is known:
    ///      buys pass the LARGER state, sells pass the SMALLER state.
    function _costDelta(int256 newQYes, int256 newQNo) internal view returns (uint256) {
        int256 cNew = _cost(newQYes, newQNo);
        int256 cOld = _cost(qYes, qNo);
        int256 d = cNew > cOld ? cNew - cOld : cOld - cNew;
        return uint256(d);
    }

    /// @dev C(q) = b · logSumExp(qY/b, qN/b), numerically stable.
    function _cost(int256 _qYes, int256 _qNo) internal view returns (int256) {
        int256 xY = (_qYes * WAD) / b;
        int256 xN = (_qNo  * WAD) / b;
        int256 m  = xY > xN ? xY : xN;
        // e^(x−m) ∈ (0,1]; sum ∈ (1,2]; ln(sum) ∈ (0, ln2]
        int256 sum = wadExp(xY - m) + wadExp(xN - m);
        return (b * (m + wadLn(sum))) / WAD;
    }

    function _ceilWadToUsdc(uint256 wad) internal pure returns (uint256) {
        return (wad + USDC_TO_WAD - 1) / USDC_TO_WAD;
    }

    function _floorWadToUsdc(uint256 wad) internal pure returns (uint256) {
        return wad / USDC_TO_WAD;
    }

    
    // Fixed-point exp / ln  solmate (Remco Bloemen / t11s), MIT
    

    function wadExp(int256 x) internal pure returns (int256 r) {
        unchecked {
            // When the result is < 0.5 we return zero.
            if (x <= -42139678854452767551) return 0;
            // Overflow guard: exp(135.something) > int256 max
            if (x >= 135305999368893231589) revert MathBounds();

            x = (x << 78) / 5**18;

            int256 k = ((x << 96) / 54916777467707473351141471128 + (2**95)) >> 96;
            x = x - k * 54916777467707473351141471128;

            int256 y = x + 1346386616545796478920950773328;
            y = ((y * x) >> 96) + 57155421227552351082224309758442;
            int256 p = y + x - 94201549194550492254356042504812;
            p = ((p * y) >> 96) + 28719021644029726153956944680412240;
            p = p * x + (4385272521454847904659076985693276 << 96);

            int256 q = x - 2855989394907223263936484059900;
            q = ((q * x) >> 96) + 50020603652535783019961831881945;
            q = ((q * x) >> 96) - 533845033583426703283633433725380;
            q = ((q * x) >> 96) + 3604857256930695427073651918091429;
            q = ((q * x) >> 96) - 14423608567350463180887372962807573;
            q = ((q * x) >> 96) + 26449188498355588339934803723976023;

            assembly { r := sdiv(p, q) }

            r = int256((uint256(r) * 3822833074963236453042738258902158003155416615667) >> uint256(195 - k));
        }
    }

    function wadLn(int256 x) internal pure returns (int256 r) {
        unchecked {
            if (x <= 0) revert MathBounds();

            assembly {
                r := shl(7, lt(0xffffffffffffffffffffffffffffffff, x))
                r := or(r, shl(6, lt(0xffffffffffffffff, shr(r, x))))
                r := or(r, shl(5, lt(0xffffffff, shr(r, x))))
                r := or(r, shl(4, lt(0xffff, shr(r, x))))
                r := or(r, shl(3, lt(0xff, shr(r, x))))
                r := or(r, shl(2, lt(0xf, shr(r, x))))
                r := or(r, shl(1, lt(0x3, shr(r, x))))
                r := or(r, lt(0x1, shr(r, x)))
            }

            int256 k = r - 96;
            x <<= uint256(159 - k);
            x = int256(uint256(x) >> 159);

            int256 p = x + 3273285459638523848632254066296;
            p = ((p * x) >> 96) + 24828157081833163892658089445524;
            p = ((p * x) >> 96) + 43456485725739037958740375743393;
            p = ((p * x) >> 96) - 11111509109440967052023855526967;
            p = ((p * x) >> 96) - 45023709667254063763336534515857;
            p = ((p * x) >> 96) - 14706773417378608786704636184526;
            p = p * x - (795164235651350426258249787498 << 96);

            int256 q = x + 5573035233440673466300451813936;
            q = ((q * x) >> 96) + 71694874799317883764090561454958;
            q = ((q * x) >> 96) + 283447036172924575727196451306956;
            q = ((q * x) >> 96) + 401686690394027663651624208769553;
            q = ((q * x) >> 96) + 204048457590392012362485061816622;
            q = ((q * x) >> 96) + 31853899698501571402653359427138;
            q = ((q * x) >> 96) + 909429971244387300277376558375;
            assembly { r := sdiv(p, q) }

            r *= 1677202110996718588342820967067443963516166;
            r += 16597577552685614221487285958193947469193820559219878177908093499208371 * k;
            r += 600920179829731861736702779321621459595472258049074101567377883020018308;
            r >>= 174;
        }
    }
}