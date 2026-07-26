// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {Market}         from "../src/Market.sol";
import {IERC20}         from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20}          from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

 
// Mock USDC (6 decimals, matches Circle USDC)
 
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) { return 6; }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

 
// Helpers
 
contract MarketTest is Test {

    // ── Actors  
    address internal factory  = makeAddr("factory");
    address internal oracle   = makeAddr("oracle");
    address internal treasury = makeAddr("treasury");
    address internal creator  = makeAddr("creator");
    address internal alice    = makeAddr("alice");
    address internal bob      = makeAddr("bob");
    address internal charlie  = makeAddr("charlie");

    // ── Contracts        
    MockUSDC internal usdc;
    Market   internal market;

    // ── Constants        
    uint256 internal constant SEED    = 100e6;   // 100 USDC
    uint256 internal constant CLOSE   = 7 days;  // relative to block.timestamp
    uint256 internal constant ALICE   = 1_000e6;
    uint256 internal constant BOB     = 1_000e6;
    uint256 internal constant CHARLIE = 1_000e6;

  
    // Setup
    

    function setUp() public {
        usdc = new MockUSDC();

        // Fund actors
        usdc.mint(creator, SEED + 10e6);
        usdc.mint(alice,   ALICE);
        usdc.mint(bob,     BOB);
        usdc.mint(charlie, CHARLIE);

        // Deploy market as factory
        vm.startPrank(factory);

        uint256 closeTime = block.timestamp + CLOSE;

        // Creator approves factory (simulating factory pull)
        vm.stopPrank();
        vm.prank(creator);
        usdc.approve(factory, SEED);
        vm.startPrank(factory);

        // Factory deploys market and sends seed USDC
        market = new Market(
            address(usdc),
            oracle,
            treasury,
            creator,
            "Will ETH close above $4,000 this Friday?",
            closeTime,
            SEED
        );
        // Simulate factory sending seed USDC to market
        usdc.mint(address(market), SEED);

        vm.stopPrank();

        // Users approve market
        vm.prank(alice);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(charlie);
        usdc.approve(address(market), type(uint256).max);
    }

 
    // Construction
      

    function test_construction_state() public view {
        assertEq(address(market.usdc()),   address(usdc));
        assertEq(market.oracle(),          oracle);
        assertEq(market.treasury(),        treasury);
        assertEq(market.feeBps(),          100);
        assertEq(uint8(market.outcome()),  uint8(Market.Outcome.UNRESOLVED));
        assertEq(market.reserveYes(),      SEED / 2);
        assertEq(market.reserveNo(),       SEED / 2);
        assertEq(market.collateral(),      SEED);
        assertEq(market.totalLpShares(),   SEED);
        assertEq(market.lpShares(creator), SEED);
    }

    function test_construction_initial_price_is_50pct() public view {
        // YES price should be 0.5e18 (50%) with equal reserves
        uint256 price = market.yesPrice();
        assertApproxEqRel(price, 0.5e18, 0.001e18); // within 0.1%
    }

    function test_construction_reverts_zero_usdc() public {
        vm.prank(factory);
        vm.expectRevert(Market.InvalidAddress.selector);
        new Market(address(0), oracle, treasury, creator, "q", block.timestamp + 1 days, SEED);
    }

    function test_construction_reverts_zero_oracle() public {
        vm.prank(factory);
        vm.expectRevert(Market.InvalidAddress.selector);
        new Market(address(usdc), address(0), treasury, creator, "q", block.timestamp + 1 days, SEED);
    }

    function test_construction_reverts_past_close() public {
        vm.prank(factory);
        vm.expectRevert(Market.MarketAlreadyClosed.selector);
        new Market(address(usdc), oracle, treasury, creator, "q", block.timestamp - 1, SEED);
    }

    function test_construction_reverts_below_min_liquidity() public {
        vm.prank(factory);
        vm.expectRevert(Market.BelowMinLiquidity.selector);
        new Market(address(usdc), oracle, treasury, creator, "q", block.timestamp + 1 days, 0);
    }

    
    // Buy
      

    function test_buy_yes_shares() public {
        uint256 usdcIn = 10e6;
        (uint256 expected,) = market.previewBuy(true, usdcIn);

        vm.prank(alice);
        uint256 sharesOut = market.buy(true, usdcIn, 0);

        assertEq(sharesOut, expected);
        assertEq(market.sharesYes(alice), sharesOut);
        assertEq(market.totalSharesYes(), sharesOut);
    }

    function test_buy_no_shares() public {
        uint256 usdcIn = 10e6;
        (uint256 expected,) = market.previewBuy(false, usdcIn);

        vm.prank(alice);
        uint256 sharesOut = market.buy(false, usdcIn, 0);

        assertEq(sharesOut, expected);
        assertEq(market.sharesNo(alice), sharesOut);
        assertEq(market.totalSharesNo(), sharesOut);
    }

function test_buy_moves_price() public {
    uint256 priceBefore = market.yesPrice();
    vm.prank(alice);
    market.buy(true, 10e6, 0);
    assertGt(market.yesPrice(), priceBefore); 
}

    function test_buy_emits_event() public {
        vm.prank(alice);
        vm.expectEmit(true, false, false, false);
        emit Market.SharesBought(alice, true, 10e6, 0, 0, 0);
        market.buy(true, 10e6, 0);
    }

    function test_buy_charges_fee() public {
        uint256 usdcIn = 100e6;
        uint256 expectedFee = (usdcIn * 100) / 10_000; // 1%

        uint256 accruedBefore = market.accruedFees();
        vm.prank(alice);
        market.buy(true, usdcIn, 0);
        uint256 accruedAfter = market.accruedFees();

        // Half fee goes to treasury accrual
        assertEq(accruedAfter - accruedBefore, expectedFee / 2);
    }

    function test_buy_reverts_below_min_trade() public {
        vm.prank(alice);
        vm.expectRevert(Market.BelowMinTrade.selector);
        market.buy(true, 1, 0); // 1 wei < MIN_TRADE (10_000)
    }

    function test_buy_reverts_slippage() public {
        vm.prank(alice);
        vm.expectRevert(Market.SlippageExceeded.selector);
        market.buy(true, 10e6, type(uint256).max); // impossible minSharesOut
    }

    function test_buy_reverts_after_close() public {
        vm.warp(block.timestamp + CLOSE + 1);
        vm.prank(alice);
        vm.expectRevert(Market.MarketAlreadyClosed.selector);
        market.buy(true, 10e6, 0);
    }

    function test_buy_reverts_when_paused() public {
        vm.prank(factory);
        market.pause();

        vm.prank(alice);
        vm.expectRevert();
        market.buy(true, 10e6, 0);
    }

     
    // Sell
      

    function test_sell_yes_shares() public {
        vm.startPrank(alice);
        uint256 shares = market.buy(true, 20e6, 0);
        uint256 usdcBefore = usdc.balanceOf(alice);

        (uint256 expected,) = market.previewSell(true, shares);
        uint256 usdcOut = market.sell(true, shares, 0);
        vm.stopPrank();

        assertEq(usdcOut, expected);
        assertEq(usdc.balanceOf(alice), usdcBefore + usdcOut);
        assertEq(market.sharesYes(alice), 0);
    }

    function test_sell_no_shares() public {
        vm.startPrank(alice);
        uint256 shares = market.buy(false, 20e6, 0);
        uint256 usdcOut = market.sell(false, shares, 0);
        vm.stopPrank();

        assertGt(usdcOut, 0);
        assertEq(market.sharesNo(alice), 0);
    }

    function test_sell_reverts_insufficient_shares() public {
        vm.prank(alice);
        vm.expectRevert(Market.InsufficientShares.selector);
        market.sell(true, 1e6, 0); // alice has no YES shares
    }

    function test_sell_reverts_slippage() public {
        vm.startPrank(alice);
        uint256 shares = market.buy(true, 10e6, 0);
        vm.expectRevert(Market.SlippageExceeded.selector);
        market.sell(true, shares, type(uint256).max);
        vm.stopPrank();
    }

    function test_buy_sell_roundtrip_less_than_input() public {
        uint256 usdcIn = 50e6;
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.startPrank(alice);
        uint256 shares = market.buy(true, usdcIn, 0);
        uint256 usdcOut = market.sell(true, shares, 0);
        vm.stopPrank();

        // After fees, should get back less than put in
        assertLt(usdcOut, usdcIn);
        assertLt(usdc.balanceOf(alice), aliceBefore);
    }

     
    // Liquidity
      

    function test_add_liquidity() public {
        uint256 addAmount = 50e6;
        usdc.mint(alice, addAmount);
        vm.startPrank(alice);
        usdc.approve(address(market), addAmount);
        uint256 lpMinted = market.addLiquidity(addAmount);
        vm.stopPrank();

        assertGt(lpMinted, 0);
        assertEq(market.lpShares(alice), lpMinted);
        assertEq(market.collateral(), SEED + addAmount);
    }

    function test_remove_liquidity() public {
        uint256 lpBefore = market.lpShares(creator);
        uint256 usdcBefore = usdc.balanceOf(creator);

        vm.prank(creator);
        uint256 usdcOut = market.removeLiquidity(lpBefore / 2);

        assertGt(usdcOut, 0);
        assertEq(usdc.balanceOf(creator), usdcBefore + usdcOut);
    }

    function test_remove_liquidity_reverts_insufficient_shares() public {
        vm.prank(alice);
        vm.expectRevert(Market.InsufficientLpShares.selector);
        market.removeLiquidity(1);
    }

    
    // Resolution
      

    function test_request_resolution_after_close() public {
        vm.warp(block.timestamp + CLOSE + 1);
        market.requestResolution();
        assertTrue(market.resolutionRequested());
    }

    function test_request_resolution_reverts_before_close() public {
        vm.expectRevert(Market.MarketNotYetClosed.selector);
        market.requestResolution();
    }

    function test_resolve_yes() public {
        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.YES);
        assertEq(uint8(market.outcome()), uint8(Market.Outcome.YES));
    }

    function test_resolve_no() public {
        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.NO);
        assertEq(uint8(market.outcome()), uint8(Market.Outcome.NO));
    }

    function test_resolve_invalid() public {
        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.INVALID);
        assertEq(uint8(market.outcome()), uint8(Market.Outcome.INVALID));
    }

    function test_resolve_reverts_not_oracle() public {
        _closeAndRequest();
        vm.prank(alice);
        vm.expectRevert(Market.OnlyOracle.selector);
        market.resolve(Market.Outcome.YES);
    }

    function test_resolve_reverts_double_resolve() public {
        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.YES);
        vm.prank(oracle);
        vm.expectRevert(Market.AlreadyResolved.selector);
        market.resolve(Market.Outcome.NO);
    }

    function test_resolve_reverts_without_request() public {
        vm.warp(block.timestamp + CLOSE + 1);
        vm.prank(oracle);
        vm.expectRevert(Market.ResolutionNotYetRequested.selector);
        market.resolve(Market.Outcome.YES);
    }

    function test_resolve_emits_event() public {
        _closeAndRequest();
        vm.prank(oracle);
        vm.expectEmit(true, true, false, false);
        emit Market.MarketResolved(Market.Outcome.YES, oracle, block.timestamp);
        market.resolve(Market.Outcome.YES);
    }

    
    // Redemption
       

    function test_redeem_yes_winner() public {
        // Alice buys YES
        vm.prank(alice);
        market.buy(true, 20e6, 0);

        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.YES);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 usdcOut = market.redeem();

        assertGt(usdcOut, 0);
        assertEq(usdc.balanceOf(alice), aliceBefore + usdcOut);
        assertEq(market.sharesYes(alice), 0);
    }

    function test_redeem_no_winner() public {
        vm.prank(bob);
        market.buy(false, 20e6, 0);

        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.NO);

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        uint256 usdcOut = market.redeem();

        assertGt(usdcOut, 0);
        assertEq(usdc.balanceOf(bob), bobBefore + usdcOut);
    }

    function test_redeem_invalid_refunds_both() public {
        vm.prank(alice);
        market.buy(true, 10e6, 0);
        vm.prank(bob);
        market.buy(false, 10e6, 0);

        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.INVALID);

        uint256 aliceBefore = usdc.balanceOf(alice);
        uint256 bobBefore   = usdc.balanceOf(bob);

        vm.prank(alice);
        uint256 aliceOut = market.redeem();
        vm.prank(bob);
        uint256 bobOut = market.redeem();

        assertGt(aliceOut, 0);
        assertGt(bobOut, 0);
        assertEq(usdc.balanceOf(alice), aliceBefore + aliceOut);
        assertEq(usdc.balanceOf(bob),   bobBefore   + bobOut);
    }

    function test_redeem_reverts_nothing_to_redeem() public {
        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.YES);

        vm.prank(alice); // alice has no YES shares
        vm.expectRevert(Market.NothingToRedeem.selector);
        market.redeem();
    }

    function test_redeem_reverts_not_resolved() public {
        vm.expectRevert(Market.MarketNotResolved.selector);
        vm.prank(alice);
        market.redeem();
    }

    function test_loser_cannot_redeem() public {
        vm.prank(alice);
        market.buy(true, 10e6, 0);  // YES
        vm.prank(bob);
        market.buy(false, 10e6, 0); // NO

        _closeAndRequest();
        vm.prank(oracle);
        market.resolve(Market.Outcome.YES); // YES wins

        // Bob (NO) tries to redeem
        vm.prank(bob);
        vm.expectRevert(Market.NothingToRedeem.selector);
        market.redeem();
    }

      
    // Fees
      

    function test_withdraw_fees() public {
        vm.prank(alice);
        market.buy(true, 100e6, 0);

        uint256 accrued = market.accruedFees();
        assertGt(accrued, 0);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        market.withdrawFees();
        assertEq(usdc.balanceOf(treasury), treasuryBefore + accrued);
        assertEq(market.accruedFees(), 0);
    }

    function test_withdraw_fees_reverts_nothing() public {
        vm.expectRevert(Market.NothingToWithdraw.selector);
        market.withdrawFees();
    }

   
    // Admin
    

    function test_rotate_oracle() public {
        address newOracle = makeAddr("newOracle");
        vm.prank(factory);
        market.rotateOracle(newOracle);
        assertEq(market.oracle(), newOracle);
    }

    function test_rotate_oracle_reverts_not_factory() public {
        vm.prank(alice);
        vm.expectRevert(Market.OnlyFactory.selector);
        market.rotateOracle(makeAddr("x"));
    }

    function test_set_fee() public {
        vm.prank(factory);
        market.setFee(200);
        assertEq(market.feeBps(), 200);
    }

    function test_set_fee_reverts_too_high() public {
        vm.prank(factory);
        vm.expectRevert(Market.FeeTooHigh.selector);
        market.setFee(501);
    }

    function test_pause_unpause() public {
        vm.prank(factory);
        market.pause();
        assertTrue(market.paused());

        vm.prank(factory);
        market.unpause();
        assertFalse(market.paused());
    }

    
    // Views
     

    function test_prices_sum_to_one() public view {
        uint256 yes = market.yesPrice();
        uint256 no  = market.noPrice();
        // YES + NO should equal PRECISION (1e18) within rounding
        assertApproxEqAbs(yes + no, 1e18, 2);
    }

    function test_is_open() public {
        assertTrue(market.isOpen());
        vm.warp(block.timestamp + CLOSE + 1);
        assertFalse(market.isOpen());
    }

    function test_preview_buy_matches_buy() public {
        uint256 usdcIn = 15e6;
        (uint256 preview,) = market.previewBuy(true, usdcIn);

        vm.prank(alice);
        uint256 actual = market.buy(true, usdcIn, 0);

        assertEq(actual, preview);
    }

    function test_preview_sell_matches_sell() public {
        vm.startPrank(alice);
        uint256 shares = market.buy(true, 20e6, 0);

        (uint256 preview,) = market.previewSell(true, shares);
        uint256 actual = market.sell(true, shares, 0);
        vm.stopPrank();

        assertEq(actual, preview);
    }

    function test_summary_view() public view {
        (
            string memory question,
            uint256 closeTime,
            Market.Outcome currentOutcome,
            uint256 yesPriceWad,
            uint256 noPriceWad,
            uint256 totalCollateral,
            ,
            ,
            bool open,
            bool resolved
        ) = market.summary();

        assertEq(question, "Will ETH close above $4,000 this Friday?");
        assertGt(closeTime, block.timestamp);
        assertEq(uint8(currentOutcome), uint8(Market.Outcome.UNRESOLVED));
        assertApproxEqRel(yesPriceWad, 0.5e18, 0.01e18);
        assertApproxEqRel(noPriceWad,  0.5e18, 0.01e18);
        assertEq(totalCollateral, SEED);
        assertTrue(open);
        assertFalse(resolved);
    }

    
    // Fuzz Tests
      

    /// @notice Fuzz: buying any valid amount should produce nonzero shares
    function testFuzz_buy_yes(uint256 usdcIn) public {
        usdcIn = bound(usdcIn, market.MIN_TRADE(), 500e6);
        usdc.mint(alice, usdcIn);
        vm.startPrank(alice);
        usdc.approve(address(market), usdcIn);
        uint256 shares = market.buy(true, usdcIn, 0);
        vm.stopPrank();
        assertGt(shares, 0);
    }

    /// @notice Fuzz: prices always sum to 1e18 after any trade
    function testFuzz_prices_sum_to_one(uint256 usdcIn) public {
        usdcIn = bound(usdcIn, market.MIN_TRADE(), 200e6);
        usdc.mint(alice, usdcIn);
        vm.startPrank(alice);
        usdc.approve(address(market), usdcIn);
        market.buy(true, usdcIn, 0);
        vm.stopPrank();

        uint256 yes = market.yesPrice();
        uint256 no  = market.noPrice();
        assertApproxEqAbs(yes + no, 1e18, 10); // allow 10 wei rounding
    }

    /// @notice Fuzz: selling all shares gives nonzero USDC
    function testFuzz_buy_sell_nonzero(uint256 usdcIn) public {
        usdcIn = bound(usdcIn, 1e6, 200e6);
        usdc.mint(alice, usdcIn);
        vm.startPrank(alice);
        usdc.approve(address(market), usdcIn);
        uint256 shares = market.buy(true, usdcIn, 0);
        if (shares > 0) {
            uint256 usdcOut = market.sell(true, shares, 0);
            assertGt(usdcOut, 0);
        }
        vm.stopPrank();
    }

    /// @notice Fuzz: collateral never goes below zero after arbitrary trades
    function testFuzz_collateral_non_negative(
        uint256 aliceIn,
        uint256 bobIn,
        bool aliceYes,
        bool bobYes
    ) public {
        aliceIn = bound(aliceIn, market.MIN_TRADE(), 100e6);
        bobIn   = bound(bobIn,   market.MIN_TRADE(), 100e6);

        usdc.mint(alice, aliceIn);
        usdc.mint(bob, bobIn);

        vm.startPrank(alice);
        usdc.approve(address(market), aliceIn);
        market.buy(aliceYes, aliceIn, 0);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(market), bobIn);
        market.buy(bobYes, bobIn, 0);
        vm.stopPrank();

        // Collateral should be positive (cannot underflow in checked Solidity)
        assertGt(market.collateral(), 0);
    }

    function test_skim_recovers_surplus() public {
        // Simulate untracked USDC arriving (e.g. Arc selfdestruct endowment)
        usdc.mint(address(market), 7e6);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 surplus = market.skim();

        assertEq(surplus, 7e6);
        assertEq(usdc.balanceOf(treasury), treasuryBefore + 7e6);
    }

    function test_skim_reverts_no_surplus() public {
        vm.expectRevert(Market.NothingToWithdraw.selector);
        market.skim();
    }

       
    // Invariant Helpers (called by Foundry invariant engine)
    

    /// @notice k = reserveYes × reserveNo should be ≥ initial k
    function invariant_k_non_decreasing() public  view  {
        uint256 k = market.getK();
        uint256 initialK = (SEED * SEED) / 4;
        assertGe(k, initialK);
    }

    /// @notice Contract USDC balance must always ≥ collateral + accruedFees
    function invariant_solvency() public view {
        uint256 balance = usdc.balanceOf(address(market));
        assertGe(balance, market.collateral() + market.accruedFees());
    }

    
    // Internal Helpers
    

    function _closeAndRequest() internal {
        vm.warp(block.timestamp + CLOSE + 1);
        market.requestResolution();
    }
}
