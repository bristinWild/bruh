export interface ApiErrorPayload {
    code?: string;
    message?: string;
}

export function getApiErrorMessage(
    error: unknown,
): string {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error
    ) {
        switch (
        (error as ApiErrorPayload).code
        ) {
            case "AGENT_OFFLINE":
                return "The selected agent is currently offline.";

            case "AGENT_TIMEOUT":
                return "The agent took too long to respond.";

            case "AGENT_VERSION_MISMATCH":
                return "The installed version doesn't match the deployed version.";

            case "INVALID_PROTOCOL":
                return "The agent returned an invalid protocol response.";

            case "INSTALLATION_DISABLED":
                return "This installation is currently disabled.";

            default:
                break;
        }
    }

    if (error instanceof Error) {
        const message =
            error.message;

        if (
            message.includes(
                "Failed to fetch",
            )
        ) {
            return "Unable to reach the server.";
        }

        if (
            message.includes(
                "NetworkError",
            )
        ) {
            return "Network connection lost.";
        }

        if (
            message.includes("500")
        ) {
            return "Internal server error.";
        }

        return message;
    }

    return "Something went wrong.";
}