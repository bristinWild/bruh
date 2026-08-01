export interface RunAgentDto {
    /**
     * Market contract the agent should analyse.
     */
    marketAddress: `0x${string}`;

    /**
     * Queue the plan automatically when it passes
     * all runtime and risk checks.
     */
    autoExecute?: boolean;
}