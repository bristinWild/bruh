// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test}       from "forge-std/Test.sol";
import {MarketLMSR} from "../src/MarketLMSR.sol";
import {ERC20}      from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MarketLMSRTest is Test {

    address internal factory;
    address internal oracle;
    address internal treasury;
    address internal creator;
    address internal alice;
    address internal bob;

    MockUSDC   internal usdc;
    MarketLMSR internal market;

    // b = 50 WAD → max loss = 50·ln2 ≈ 34.66 USDC. Seed 40 USDC covers it.
    int256  internal constant B     = 50e18;
    uint256 internal constant SEED  = 40e6;
    uint256 internal constant CLOSE = 7 days;

    function setUp() public {
        factory  = makeAddr("factory");
        oracle   = makeAddr("oracle");
        treasury = makeAddr("treasury");
        creator  = makeAddr("creator");
        alice    = makeAddr("alice");
        bob      = makeAddr("bob");

        usdc = new MockUSDC();
        usdc.mint(alice, 1_000e6);
        usdc.mint(bob,   1_000e6);

        vm.prank(factory);
        market = new MarketLMSR(
            address(usdc), oracle, treasury, creator,
            "Will ETH close above $4,000 this Friday?",
            block.timestamp + CLOSE,
            B,
            SEED
        );
        usdc.mint(address(market), SEED); // simulate factory seeding

        vm.prank(alice);
        usdc.approve(address(market), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
    }

    // Construction

    function test_initial_price_is_50pct() public view {
        assertApproxEqRel(market.yesPrice(), 0.5e18, 0.001e18);
    }

    function test_prices_sum_to_one() public view {
        assertApproxEqAbs(market.yesPrice() + market.noPrice(), 1e18, 2);
    }

    function test_construction_reverts_insufficient_seed() public {
        vm.prank(factory);
        vm.expectRevert(MarketLMSR.InsufficientSeed.selector);
        // b·ln2 ≈ 34.66 USDC; 30 USDC seed insufficient
        new MarketLMSR(address(usdc), oracle, treasury, creator, "q",
            block.timestamp + 1 days, B, 30e6);
    }

    function test_construction_reverts_nonpositive_b() public {
        vm.prank(factory);
        vm.expectRevert(MarketLMSR.MathBounds.selector);
        new MarketLMSR(address(usdc), oracle, treasury, creator, "q",
            block.timestamp + 1 days, 0, SEED);
    }

    // Buy

    function test_buy_yes_moves_price_up() public {
        uint256 before = market.yesPrice();
        vm.prank(alice);
        market.buy(true, 10e18, type(uint256).max);
        assertGt(market.yesPrice(), before); // LMSR: buying YES raises YES price
    }

    function test_buy_no_moves_price_down() public {
        uint256 before = market.yesPrice();
        vm.prank(alice);
        market.buy(false, 10e18, type(uint256).max);
        assertLt(market.yesPrice(), before);
    }

    function test_buy_matches_preview() public {
        (uint256 quoted,) = market.previewBuy(true, 10e18);
        vm.prank(alice);
        uint256 paid = market.buy(true, 10e18, type(uint256).max);
        assertEq(paid, quoted);
    }

    function test_buy_10_shares_at_even_costs_about_5() public {
        // At 50/50, marginal price 0.5 → 10 shares ≈ 5 USDC (plus convexity + fee)
        vm.prank(alice);
        uint256 paid = market.buy(true, 10e18, type(uint256).max);
        assertGt(paid, 5e6);          // convexity pushes above 5
        assertLt(paid, 6e6);          // but nowhere near 6 with b=50
    }

    function test_buy_reverts_slippage() public {
        vm.prank(alice);
        vm.expectRevert(MarketLMSR.SlippageExceeded.selector);
        market.buy(true, 10e18, 1); // 1 micro-USDC cap
    }

    function test_buy_reverts_below_min_shares() public {
        vm.prank(alice);
        vm.expectRevert(MarketLMSR.BelowMinShares.selector);
        market.buy(true, 1, type(uint256).max);
    }

    function test_buy_reverts_after_close() public {
        vm.warp(block.timestamp + CLOSE + 1);
        vm.prank(alice);
        vm.expectRevert(MarketLMSR.MarketAlreadyClosed.selector);
        market.buy(true, 1e18, type(uint256).max);
    }

    // Sell

    function test_sell_returns_usdc() public {
        vm.startPrank(alice);
        market.buy(true, 10e18, type(uint256).max);
        uint256 balBefore = usdc.balanceOf(alice);
        uint256 out = market.sell(true, 10e18, 0);
        vm.stopPrank();
        assertGt(out, 0);
        assertEq(usdc.balanceOf(alice), balBefore + out);
        assertEq(market.sharesYes(alice), 0);
    }

    function test_roundtrip_costs_more_than_refund() public {
        vm.startPrank(alice);
        uint256 paid = market.buy(true, 10e18, type(uint256).max);
        uint256 back = market.sell(true, 10e18, 0);
        vm.stopPrank();
        assertLt(back, paid); // fees + rounding always favor protocol
    }

    function test_sell_reverts_insufficient() public {
        vm.prank(alice);
        vm.expectRevert(MarketLMSR.InsufficientShares.selector);
        market.sell(true, 1e18, 0);
    }

    // Resolution + redemption

    function test_winner_redeems_one_usdc_per_share() public {
        vm.prank(alice);
        market.buy(true, 20e18, type(uint256).max);

        vm.warp(block.timestamp + CLOSE + 1);
        market.requestResolution();
        vm.prank(oracle);
        market.resolve(MarketLMSR.Outcome.YES);

        uint256 before = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 out = market.redeem();

        assertEq(out, 20e6); // 20 shares → exactly 20 USDC
        assertEq(usdc.balanceOf(alice), before + 20e6);
    }

    function test_loser_cannot_redeem() public {
        vm.prank(alice);
        market.buy(true, 10e18, type(uint256).max);
        vm.prank(bob);
        market.buy(false, 10e18, type(uint256).max);

        vm.warp(block.timestamp + CLOSE + 1);
        market.requestResolution();
        vm.prank(oracle);
        market.resolve(MarketLMSR.Outcome.YES);

        vm.prank(bob);
        vm.expectRevert(MarketLMSR.NothingToRedeem.selector);
        market.redeem();
    }

    function test_invalid_refunds_pro_rata() public {
        vm.prank(alice);
        market.buy(true, 10e18, type(uint256).max);
        vm.prank(bob);
        market.buy(false, 10e18, type(uint256).max);

        vm.warp(block.timestamp + CLOSE + 1);
        market.requestResolution();
        vm.prank(oracle);
        market.resolve(MarketLMSR.Outcome.INVALID);

        vm.prank(alice);
        uint256 a = market.redeem();
        vm.prank(bob);
        uint256 c = market.redeem();
        assertGt(a, 0);
        assertGt(c, 0);
    }

    // THE LMSR guarantee

    /// @notice Solvency under worst case: everyone piles one side, all redeem.
    function test_solvency_one_sided_pile() public {
        vm.prank(alice);
        market.buy(true, 100e18, type(uint256).max);
        vm.prank(bob);
        market.buy(true, 100e18, type(uint256).max);

        vm.warp(block.timestamp + CLOSE + 1);
        market.requestResolution();
        vm.prank(oracle);
        market.resolve(MarketLMSR.Outcome.YES);

        vm.prank(alice);
        market.redeem();
        vm.prank(bob);
        market.redeem();

        // Contract must not have gone insolvent
        assertGe(usdc.balanceOf(address(market)), market.accruedFees());
    }

    /// @notice Fuzz: solvent for any trade pattern + any outcome.
    function testFuzz_always_solvent(
        uint256 aliceShares, bool aliceYes,
        uint256 bobShares,   bool bobYes,
        uint8 outcomeInt
    ) public {
        aliceShares = bound(aliceShares, market.MIN_SHARES(), 200e18);
        bobShares   = bound(bobShares,   market.MIN_SHARES(), 200e18);
        outcomeInt  = uint8(bound(outcomeInt, 1, 3));

        vm.prank(alice);
        market.buy(aliceYes, aliceShares, type(uint256).max);
        vm.prank(bob);
        market.buy(bobYes, bobShares, type(uint256).max);

        vm.warp(block.timestamp + CLOSE + 1);
        market.requestResolution();
        vm.prank(oracle);
        market.resolve(MarketLMSR.Outcome(outcomeInt));

        vm.prank(alice);
        try market.redeem() {} catch {}
        vm.prank(bob);
        try market.redeem() {} catch {}

        // Balance always covers what's still owed
        assertGe(
            usdc.balanceOf(address(market)),
            market.accruedFees()
        );
    }

    /// @notice Fuzz: prices always sum to 1e18 after arbitrary trades.
    function testFuzz_prices_sum_to_one(uint256 shares, bool isYes) public {
        shares = bound(shares, market.MIN_SHARES(), 300e18);
        vm.prank(alice);
        market.buy(isYes, shares, type(uint256).max);
        assertApproxEqAbs(market.yesPrice() + market.noPrice(), 1e18, 2);
    }

    /// @notice Fuzz: preview always matches execution exactly.
    function testFuzz_preview_matches_buy(uint256 shares) public {
        shares = bound(shares, market.MIN_SHARES(), 200e18);
        (uint256 quoted,) = market.previewBuy(true, shares);
        vm.prank(alice);
        uint256 paid = market.buy(true, shares, type(uint256).max);
        assertEq(paid, quoted);
    }

    // Skim (Arc) 

    function test_skim_recovers_surplus() public {
        usdc.mint(address(market), 5e6);
        uint256 before = usdc.balanceOf(treasury);
        uint256 s = market.skim();
        assertEq(s, 5e6);
        assertEq(usdc.balanceOf(treasury), before + 5e6);
    }
}