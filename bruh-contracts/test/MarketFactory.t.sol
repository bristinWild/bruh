// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2}  from "forge-std/Test.sol";
import {MarketFactory}   from "../src/MarketFactory.sol";
import {Market}          from "../src/Market.sol";
import {ERC20}           from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MarketFactoryTest is Test {

    address internal owner    = makeAddr("owner");
    address internal oracle   = makeAddr("oracle");
    address internal treasury = makeAddr("treasury");
    address internal alice    = makeAddr("alice");
    address internal bob      = makeAddr("bob");

    MockUSDC       internal usdc;
    MarketFactory  internal factory;

    uint256 internal constant SEED = 10e6; // min seed

    function setUp() public {
        usdc    = new MockUSDC();
        factory = new MarketFactory(address(usdc), oracle, treasury, owner);

        usdc.mint(alice, 1_000e6);
        usdc.mint(bob,   1_000e6);

        vm.prank(alice);
        usdc.approve(address(factory), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(factory), type(uint256).max);
    }

     
    // Construction
     

    function test_construction() public view {
        assertEq(address(factory.usdc()),   address(usdc));
        assertEq(factory.defaultOracle(),   oracle);
        assertEq(factory.treasury(),        treasury);
        assertEq(factory.defaultFeeBps(),   100);
        assertEq(factory.owner(),           owner);
        assertEq(factory.marketCount(),     0);
    }

     
    // Market Creation
     

    function test_create_market() public {
        vm.prank(alice);
        address market = factory.createMarket(
            "Will BTC hit $100k?",
            block.timestamp + 7 days,
            SEED,
            address(0)
        );

        assertNotEq(market, address(0));
        assertTrue(factory.isMarket(market));
        assertEq(factory.marketCount(), 1);
    }

    function test_create_market_emits_event() public {
        vm.prank(alice);
        vm.expectEmit(false, true, false, false);
        emit MarketFactory.MarketCreated(
            address(0), // market address unknown ahead of time
            alice,
            oracle,
            "Will BTC hit $100k?",
            block.timestamp + 7 days,
            SEED,
            0
        );
        factory.createMarket("Will BTC hit $100k?", block.timestamp + 7 days, SEED, address(0));
    }

    function test_create_market_custom_oracle() public {
        address customOracle = makeAddr("customOracle");
        vm.prank(alice);
        address market = factory.createMarket(
            "Q?",
            block.timestamp + 1 days,
            SEED,
            customOracle
        );
        assertEq(Market(market).oracle(), customOracle);
    }

    function test_create_market_indexes_by_creator() public {
        vm.prank(alice);
        address m1 = factory.createMarket("Q1?", block.timestamp + 1 days, SEED, address(0));
        vm.prank(alice);
        address m2 = factory.createMarket("Q2?", block.timestamp + 2 days, SEED, address(0));
        vm.prank(bob);
        address m3 = factory.createMarket("Q3?", block.timestamp + 3 days, SEED, address(0));

        address[] memory aliceMarkets = factory.getMarketsByCreator(alice);
        assertEq(aliceMarkets.length, 2);
        assertEq(aliceMarkets[0], m1);
        assertEq(aliceMarkets[1], m2);

        address[] memory bobMarkets = factory.getMarketsByCreator(bob);
        assertEq(bobMarkets.length, 1);
        assertEq(bobMarkets[0], m3);
    }

    function test_create_market_reverts_empty_question() public {
        vm.prank(alice);
        vm.expectRevert(MarketFactory.InvalidQuestion.selector);
        factory.createMarket("", block.timestamp + 1 days, SEED, address(0));
    }

    function test_create_market_reverts_duration_too_short() public {
        vm.prank(alice);
        vm.expectRevert(MarketFactory.DurationTooShort.selector);
        factory.createMarket("Q?", block.timestamp + 30 minutes, SEED, address(0));
    }

    function test_create_market_reverts_duration_too_long() public {
        vm.prank(alice);
        vm.expectRevert(MarketFactory.DurationTooLong.selector);
        factory.createMarket("Q?", block.timestamp + 400 days, SEED, address(0));
    }

    function test_create_market_reverts_seed_below_min() public {
        vm.prank(alice);
        vm.expectRevert(MarketFactory.SeedBelowMinimum.selector);
        factory.createMarket("Q?", block.timestamp + 1 days, 1e6, address(0)); // 1 USDC < 10 USDC min
    }

    function test_create_market_reverts_seed_above_max() public {
        usdc.mint(alice, 200_000e6);
        vm.prank(alice);
        vm.expectRevert(MarketFactory.SeedAboveMaximum.selector);
        factory.createMarket("Q?", block.timestamp + 1 days, 101_000e6, address(0));
    }

    function test_create_market_reverts_when_paused() public {
        vm.prank(owner);
        factory.pause();

        vm.prank(alice);
        vm.expectRevert();
        factory.createMarket("Q?", block.timestamp + 1 days, SEED, address(0));
    }

     
    // Whitelist
     

    function test_whitelist_blocks_non_creator() public {
        vm.prank(owner);
        factory.setCreationWhitelisted(true);

        vm.prank(bob); // not whitelisted
        vm.expectRevert(MarketFactory.NotWhitelisted.selector);
        factory.createMarket("Q?", block.timestamp + 1 days, SEED, address(0));
    }

    function test_whitelist_allows_creator() public {
        vm.prank(owner);
        factory.setCreationWhitelisted(true);
        vm.prank(owner);
        factory.setCreator(alice, true);

        vm.prank(alice);
        address market = factory.createMarket("Q?", block.timestamp + 1 days, SEED, address(0));
        assertTrue(factory.isMarket(market));
    }

     
    // Admin
     

    function test_set_default_oracle() public {
        address newOracle = makeAddr("newOracle");
        vm.prank(owner);
        factory.setDefaultOracle(newOracle);
        assertEq(factory.defaultOracle(), newOracle);
    }

    function test_set_treasury() public {
        address newTreasury = makeAddr("newTreasury");
        vm.prank(owner);
        factory.setTreasury(newTreasury);
        assertEq(factory.treasury(), newTreasury);
    }

    function test_rotate_oracle_on_market() public {
        vm.prank(alice);
        address market = factory.createMarket("Q?", block.timestamp + 1 days, SEED, address(0));

        address newOracle = makeAddr("newOracle");
        vm.prank(owner);
        factory.rotateOracle(market, newOracle);
        assertEq(Market(market).oracle(), newOracle);
    }

    function test_rotate_oracle_reverts_not_market() public {
        vm.prank(owner);
        vm.expectRevert(MarketFactory.NotAMarket.selector);
        factory.rotateOracle(makeAddr("notAMarket"), oracle);
    }

    function test_pause_market() public {
        vm.prank(alice);
        address market = factory.createMarket("Q?", block.timestamp + 1 days, SEED, address(0));

        vm.prank(owner);
        factory.pauseMarket(market);
        assertTrue(Market(market).paused());
    }

    function test_admin_reverts_not_owner() public {
        vm.prank(alice);
        vm.expectRevert();
        factory.setDefaultOracle(makeAddr("x"));
    }

     
    // Views
     

    function test_get_markets_paginated() public {
        vm.startPrank(alice);
        for (uint256 i; i < 5; ++i) {
            factory.createMarket(
                string(abi.encodePacked("Q", i)),
                block.timestamp + (i + 1) * 1 days,
                SEED,
                address(0)
            );
        }
        vm.stopPrank();

        address[] memory page1 = factory.getMarkets(0, 3);
        assertEq(page1.length, 3);

        address[] memory page2 = factory.getMarkets(3, 3);
        assertEq(page2.length, 2);

        address[] memory empty = factory.getMarkets(10, 5);
        assertEq(empty.length, 0);
    }

    function test_is_market_false_for_random() public {
        assertFalse(factory.isMarket(makeAddr("random")));
    }
}
