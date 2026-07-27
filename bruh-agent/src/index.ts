import { CONFIG } from "./config.js";
import { runAgentCycle, AgentConfig } from "./agent.js";

const AGENTS: AgentConfig[] = [
    {
        name: "Newshound",
        strategy: "news momentum — weights recent developments heavily",
        privateKey: CONFIG.NEWSHOUND_KEY,
        markets: [CONFIG.MARKET_1, CONFIG.MARKET_2],
    },
    {
        name: "Actuary",
        strategy: "base rates — anchors on historical priors, fades overconfident moves",
        privateKey: CONFIG.ACTUARY_KEY,
        markets: [CONFIG.MARKET_1, CONFIG.MARKET_2],
    },
];

async function main() {
    console.log("🚀 Bruh Agent System starting...");
    console.log(`   Markets: ${CONFIG.MARKET_1}, ${CONFIG.MARKET_2}`);
    console.log(`   Cycle interval: ${CONFIG.CYCLE_INTERVAL_MS / 1000}s`);
    console.log(`   Edge threshold: ${CONFIG.EDGE_THRESHOLD * 100}%`);
    console.log(`   Kelly fraction: ${CONFIG.KELLY_FRACTION * 100}%\n`);

    // Filter agents with valid keys
    const activeAgents = AGENTS.filter(
        (a) => a.privateKey && a.privateKey !== "undefined"
    );

    if (activeAgents.length === 0) {
        console.error("❌ No agent private keys configured. Set NEWSHOUND_PRIVATE_KEY or ACTUARY_PRIVATE_KEY in .env");
        process.exit(1);
    }

    console.log(`✅ ${activeAgents.length} agent(s) active: ${activeAgents.map((a) => a.name).join(", ")}\n`);

    // Main loop
    while (true) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`⏰ ${new Date().toISOString()}`);
        console.log("=".repeat(60));

        for (const agent of activeAgents) {
            const decisions = await runAgentCycle(agent);
            const trades = decisions.filter((d) => d.action !== "PASS");
            console.log(`\n📋 [${agent.name}] Cycle complete — ${trades.length} trade(s) executed`);
        }

        console.log(`\n😴 Sleeping ${CONFIG.CYCLE_INTERVAL_MS / 1000}s...\n`);
        await new Promise((r) => setTimeout(r, CONFIG.CYCLE_INTERVAL_MS));
    }
}

main().catch(console.error);