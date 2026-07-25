// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MarketFactory}    from "../src/MarketFactory.sol";
import {Market}           from "../src/Market.sol";
import {OracleJob}        from "../src/OracleJob.sol";

/// @notice Deploy Bruh Protocol to Arc Testnet
///
/// Usage:
///   forge script script/Deploy.s.sol \
///     --rpc-url $ARC_RPC_URL \
///     --broadcast \
///     --verify \
///     -vvvv
///
/// Required env vars (see .env.example):
///   PRIVATE_KEY      deployer private key
///   USDC_ADDRESS     USDC contract on Arc testnet
///   ORACLE_ADDRESS   agent wallet that will resolve markets
///   TREASURY_ADDRESS protocol fee recipient
///   SEED_USDC        initial liquidity per demo market (6 decimals)

contract DeployScript is Script {

    function run() external {
        //  Load env 
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc        = vm.envAddress("USDC_ADDRESS");
        address oracle      = vm.envAddress("ORACLE_ADDRESS");
        address treasury    = vm.envAddress("TREASURY_ADDRESS");
        uint256 seedUsdc    = vm.envOr("SEED_USDC", uint256(100e6));

        address deployer = vm.addr(deployerKey);

        console2.log("=== Bruh Protocol Deployment ===");
        console2.log("Deployer :", deployer);
        console2.log("USDC     :", usdc);
        console2.log("Oracle   :", oracle);
        console2.log("Treasury :", treasury);
        console2.log("Seed USDC:", seedUsdc / 1e6, "USDC");
        console2.log("");

        vm.startBroadcast(deployerKey);

        //  1. Deploy MarketFactory 
        MarketFactory factory = new MarketFactory(
            usdc,
            oracle,
            treasury,
            deployer
        );
        console2.log("MarketFactory:", address(factory));

        //  2. Deploy OracleJob 
        OracleJob oracleJob = new OracleJob(
            usdc,
            treasury,
            deployer
        );
        console2.log("OracleJob    :", address(oracleJob));

        //  3. Authorise oracle in OracleJob 
        oracleJob.setOracle(oracle, true);
        console2.log("Oracle authorised in OracleJob");

        //  4. Approve factory to pull seed USDC 
        (bool ok,) = usdc.call(
            abi.encodeWithSignature(
                "approve(address,uint256)",
                address(factory),
                seedUsdc * 3
            )
        );
        require(ok, "USDC approval failed");

        //  5. Create demo markets 
        address m1 = factory.createMarket(
            "Will ETH close above $4,000 this Friday?",
            block.timestamp + 5 days,
            seedUsdc,
            address(0)
        );
        console2.log("Market 1 (ETH $4k) :", m1);

        address m2 = factory.createMarket(
            "Will the Fed announce a rate cut in September 2026?",
            block.timestamp + 30 days,
            seedUsdc,
            address(0)
        );
        console2.log("Market 2 (Fed rate) :", m2);

        address m3 = factory.createMarket(
            "Will Bitcoin ETF inflows exceed $1B this week?",
            block.timestamp + 7 days,
            seedUsdc,
            address(0)
        );
        console2.log("Market 3 (BTC ETF)  :", m3);

        vm.stopBroadcast();

        // Print summary 
        console2.log("");
        console2.log("=== Deployment Summary ===");
        console2.log("MarketFactory :", address(factory));
        console2.log("OracleJob     :", address(oracleJob));
        console2.log("Market 1      :", m1);
        console2.log("Market 2      :", m2);
        console2.log("Market 3      :", m3);
        console2.log("");
        console2.log("Next steps:");
        console2.log("1. Transfer factory ownership to multisig");
        console2.log("2. Transfer oracleJob ownership to multisig");
        console2.log("3. Fund oracle wallet with USDC (for bond + fees)");
        console2.log("4. Start agent processes with factory + oracleJob addresses");
        console2.log("5. Verify contracts on testnet.arcscan.app");
    }
}

/// @notice Create a resolution job for a closed market (called by anyone)
contract CreateJobScript is Script {

    function run() external {
        uint256 callerKey   = vm.envUint("PRIVATE_KEY");
        address oracleJob   = vm.envAddress("ORACLE_JOB_ADDRESS");
        address marketAddr  = vm.envAddress("MARKET_ADDRESS");

        console2.log("Creating resolution job for market:", marketAddr);

        vm.startBroadcast(callerKey);
        uint256 jobId = OracleJob(oracleJob).createJob(marketAddr);
        vm.stopBroadcast();

        console2.log("Job created with ID:", jobId);
    }
}

/// @notice Oracle accepts a job and posts bond
contract AcceptJobScript is Script {

    function run() external {
        uint256 oracleKey  = vm.envUint("ORACLE_PRIVATE_KEY");
        address oracleJob  = vm.envAddress("ORACLE_JOB_ADDRESS");
        uint256 jobId      = vm.envUint("JOB_ID");

        console2.log("Accepting job:", jobId);

        vm.startBroadcast(oracleKey);
        OracleJob(oracleJob).acceptJob(jobId);
        vm.stopBroadcast();

        console2.log("Job accepted");
    }
}

/// @notice Oracle submits outcome with evidence
contract SubmitOutcomeScript is Script {

    function run() external {
        uint256 oracleKey   = vm.envUint("ORACLE_PRIVATE_KEY");
        address oracleJob   = vm.envAddress("ORACLE_JOB_ADDRESS");
        uint256 jobId       = vm.envUint("JOB_ID");
        uint8   outcomeInt  = uint8(vm.envUint("OUTCOME")); 
        string  memory uri  = vm.envString("EVIDENCE_URI"); 

        Market.Outcome outcome = Market.Outcome(outcomeInt);

        console2.log("Submitting outcome for job:", jobId);
        console2.log("Outcome   :", outcomeInt);
        console2.log("Evidence  :", uri);

        vm.startBroadcast(oracleKey);
        OracleJob(oracleJob).submitOutcome(jobId, outcome, uri);
        vm.stopBroadcast();

        console2.log("Outcome submitted - dispute window open for 24h");
    }
}

/// @notice Finalise a job after dispute window (anyone can call)
contract FinaliseJobScript is Script {

    function run() external {
        uint256 callerKey  = vm.envUint("PRIVATE_KEY");
        address oracleJob  = vm.envAddress("ORACLE_JOB_ADDRESS");
        uint256 jobId      = vm.envUint("JOB_ID");

        console2.log("Finalising job:", jobId);

        vm.startBroadcast(callerKey);
        OracleJob(oracleJob).finalise(jobId);
        vm.stopBroadcast();

        console2.log("Job finalised - market resolved");
    }
}