// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MarketFactory}    from "../src/MarketFactory.sol";
import {Market}           from "../src/Market.sol";
import {OracleJob}        from "../src/OracleJob.sol";
import {IERC20}           from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployScript is Script {

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc        = vm.envAddress("USDC_ADDRESS");
        address oracle      = vm.envAddress("ORACLE_ADDRESS");
        address treasury    = vm.envAddress("TREASURY_ADDRESS");
        uint256 seedUsdc    = vm.envOr("SEED_USDC", uint256(10e6));

        address deployer = vm.addr(deployerKey);

        console2.log("=== Bruh Protocol Deployment ===");
        console2.log("Deployer :", deployer);
        console2.log("USDC     :", usdc);
        console2.log("Oracle   :", oracle);
        console2.log("Seed USDC:", seedUsdc / 1e6, "USDC");

        vm.startBroadcast(deployerKey);

        // 1. Deploy MarketFactory
        MarketFactory factory = new MarketFactory(
            usdc, oracle, treasury, deployer
        );
        console2.log("MarketFactory:", address(factory));

        // 2. Deploy OracleJob
        OracleJob oracleJob = new OracleJob(usdc, treasury, deployer);
        console2.log("OracleJob    :", address(oracleJob));
        oracleJob.setOracle(oracle, true);

        // 3. Deploy Market directly (bypass factory transferFrom — Arc testnet workaround)
        // Transfer seed to market AFTER deployment using native transfer
        Market m1 = new Market(
            usdc,
            oracle,
            treasury,
            deployer,
            "Will ETH close above $4,000 this Friday?",
            block.timestamp + 5 days,
            seedUsdc
        );
        // Fund market directly — native USDC send (no transferFrom needed)
        IERC20(usdc).transfer(address(m1), seedUsdc);
        console2.log("Market 1:", address(m1));

        Market m2 = new Market(
            usdc,
            oracle,
            treasury,
            deployer,
            "Will the Fed announce a rate cut in September 2026?",
            block.timestamp + 30 days,
            seedUsdc
        );
        IERC20(usdc).transfer(address(m2), seedUsdc);
        console2.log("Market 2:", address(m2));

        vm.stopBroadcast();

        console2.log("");
        console2.log("=== Deployment Summary ===");
        console2.log("MarketFactory :", address(factory));
        console2.log("OracleJob     :", address(oracleJob));
        console2.log("Market 1      :", address(m1));
        console2.log("Market 2      :", address(m2));
        console2.log("");
        console2.log("Verify at: https://testnet.arcscan.app");
    }
}