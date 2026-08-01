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

export async function runAgent(
    token: string,
    walletId: string,
    marketAddress: string,
    autoExecute = false,
) {
    const res = await fetch(
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

    const data = await res.json();

    if (!res.ok) {
        throw new Error(
            data?.message ||
            `Agent run failed with status ${res.status}`,
        );
    }

    return data;
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