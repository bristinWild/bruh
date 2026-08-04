import {
    defineAgent,
    validateAgentManifest,

    // Expected TypeScript error:
    runAgentRuntime,
} from "@bruhmarket/agent-sdk";

console.log({
    defineAgent:
        typeof defineAgent,

    validateAgentManifest:
        typeof validateAgentManifest,

    runAgentRuntime:
        typeof runAgentRuntime,
});