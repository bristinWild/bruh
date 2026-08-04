

import type {
    AgentRun,
    RunAgentResponse,
    AgentAutonomyConfig,
    UpdateAgentAutonomyConfig,
} from "@/components/dashboard/dashboard.types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export async function getNonce(): Promise<string> {
    const res = await fetch(`${API_URL}/auth/nonce`);
    const data = await res.json();
    return data.message;
}

export async function verifySignature(
    address: string,
    signature: string,
    message: string
): Promise<string> {
    const res = await fetch(`${API_URL}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, signature, message }),
    });
    const data = await res.json();
    return data.token;
}

export async function createAgentWallet(token: string, strategy: string, agentName: string): Promise<any> {
    const res = await fetch(`${API_URL}/wallets`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ strategy, agentName }),
    });
    return res.json();
}

export async function getMyWallets(token: string): Promise<any[]> {
    const res = await fetch(`${API_URL}/wallets`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
}


export async function getRuns(
    token: string,
    walletId: string,
) {
    const res = await fetch(
        `${API_URL}/agents/${walletId}/runs`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    if (!res.ok) {
        throw new Error(await res.text());
    }

    return res.json();
}

export async function runAgent(
    token: string,
    walletId: string,
    marketAddress: string,
    autoExecute = false,
): Promise<RunAgentResponse> {
    const response = await fetch(
        `${API_URL}/agents/${walletId}/run`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                marketAddress,
                autoExecute,
            }),
        },
    );

    return readApiResponse<RunAgentResponse>(
        response,
    );
}

export async function getAgentRuns(
    token: string,
    walletId: string,
    limit = 30,
): Promise<AgentRun[]> {
    const response = await fetch(
        `${API_URL}/agents/${walletId}/runs?limit=${limit}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    const data =
        await readApiResponse<unknown>(
            response,
        );

    return Array.isArray(data)
        ? (data as AgentRun[])
        : [];
}

export async function getAgentRun(
    token: string,
    runId: string,
): Promise<AgentRun> {
    const response = await fetch(
        `${API_URL}/agents/runs/${runId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    return readApiResponse<AgentRun>(
        response,
    );
}

async function readApiResponse<T>(
    response: Response,
): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
        const message =
            typeof data?.message === "string"
                ? data.message
                : `Request failed with status ${response.status}`;

        throw new Error(message);
    }

    return data as T;
}


export async function getAgentAutonomy(
    token: string,
    walletId: string,
): Promise<AgentAutonomyConfig> {
    const response = await fetch(
        `${API_URL}/agents/${walletId}/autonomy`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.message ??
            `Failed to load autonomy configuration with status ${response.status}`,
        );
    }

    return data as AgentAutonomyConfig;
}

export async function updateAgentAutonomy(
    token: string,
    walletId: string,
    config: UpdateAgentAutonomyConfig,
): Promise<unknown> {
    const response = await fetch(
        `${API_URL}/agents/${walletId}/autonomy`,
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(config),
        },
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data?.message ??
            `Failed to update autonomy configuration with status ${response.status}`,
        );
    }

    return data;
}