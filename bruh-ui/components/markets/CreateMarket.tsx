"use client";

import Link from "next/link";
import {
    useMemo,
    useState,
} from "react";

import {
    motion,
    useReducedMotion,
} from "framer-motion";

import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Coins,
    ExternalLink,
    FileQuestion,
    ShieldCheck,
    Sparkles,
    WalletCards,
    Zap,
} from "lucide-react";

import MarketWalletButton from "@/components/markets/MarketWalletButton";

import {
    useAccount,
    useChainId,
    usePublicClient,
    useReadContract,
    useSwitchChain,
    useWriteContract,
} from "wagmi";

import {
    formatUnits,
    parseAbi,
    parseEventLogs,
    parseUnits,
    zeroAddress,
} from "viem";

import {
    useRouter,
} from "next/navigation";

const ARC_TESTNET_CHAIN_ID =
    5042002;

const ARC_TESTNET_USDC =
    "0x3600000000000000000000000000000000000000" as const;

/*
 * Set this in .env.local.
 *
 * NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=0x...
 */
const MARKET_FACTORY_ADDRESS =
    process.env
        .NEXT_PUBLIC_MARKET_FACTORY_ADDRESS as
    | `0x${string}`
    | undefined;

const SEED_USDC =
    15;

const ARC_TESTNET_EXPLORER =
    "https://testnet.arcscan.app";

const ERC20_ABI =
    parseAbi([
        "function balanceOf(address account) view returns (uint256)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function approve(address spender, uint256 amount) returns (bool)",
    ]);

const MARKET_FACTORY_ABI =
    parseAbi([
        "function createMarket(string question, uint256 closeTime, uint256 seedUsdc, address oracle) returns (address market)",
        "function creationWhitelisted() view returns (bool)",
        "function creators(address account) view returns (bool)",
        "event MarketCreated(address indexed market, address indexed creator, address indexed oracle, string question, uint256 closeTime, uint256 seedUsdc, uint256 marketId)",
    ]);

type CreateStatus =
    | "idle"
    | "approving"
    | "creating"
    | "success";

function formatError(
    error: unknown,
): string {
    if (
        error instanceof Error
    ) {
        if (
            error.message.includes(
                "User rejected",
            ) ||
            error.message.includes(
                "User denied",
            )
        ) {
            return "Transaction cancelled.";
        }

        return error.message;
    }

    return "Something went wrong.";
}

export default function CreateMarket() {
    const router =
        useRouter();

    const reduceMotion =
        useReducedMotion();

    const {
        address,
        isConnected,
    } =
        useAccount();

    const chainId =
        useChainId();

    const {
        switchChainAsync,
    } =
        useSwitchChain();

    const publicClient =
        usePublicClient({
            chainId:
                ARC_TESTNET_CHAIN_ID,
        });

    const {
        writeContractAsync,
    } =
        useWriteContract();

    const [
        question,
        setQuestion,
    ] =
        useState("");

    const [
        closeDate,
        setCloseDate,
    ] =
        useState("");

    const [
        status,
        setStatus,
    ] =
        useState<CreateStatus>(
            "idle",
        );

    const [
        error,
        setError,
    ] =
        useState<
            string | null
        >(null);

    const [
        approvalHash,
        setApprovalHash,
    ] =
        useState<
            `0x${string}` | null
        >(null);

    const [
        createHash,
        setCreateHash,
    ] =
        useState<
            `0x${string}` | null
        >(null);

    const [
        createdMarket,
        setCreatedMarket,
    ] =
        useState<
            `0x${string}` | null
        >(null);

    const isArcTestnet =
        chainId ===
        ARC_TESTNET_CHAIN_ID;

    const {
        data:
        usdcBalanceRaw,
        isLoading:
        balanceLoading,
        refetch:
        refetchBalance,
    } =
        useReadContract({
            address:
                ARC_TESTNET_USDC,

            abi:
                ERC20_ABI,

            functionName:
                "balanceOf",

            args:
                address
                    ? [
                        address,
                    ]
                    : undefined,

            chainId:
                ARC_TESTNET_CHAIN_ID,

            query: {
                enabled:
                    Boolean(
                        address,
                    ) &&
                    isConnected &&
                    isArcTestnet,
            },
        });

    const {
        data:
        allowanceRaw,
        refetch:
        refetchAllowance,
    } =
        useReadContract({
            address:
                ARC_TESTNET_USDC,

            abi:
                ERC20_ABI,

            functionName:
                "allowance",

            args:
                address &&
                    MARKET_FACTORY_ADDRESS
                    ? [
                        address,
                        MARKET_FACTORY_ADDRESS,
                    ]
                    : undefined,

            chainId:
                ARC_TESTNET_CHAIN_ID,

            query: {
                enabled:
                    Boolean(
                        address,
                    ) &&
                    Boolean(
                        MARKET_FACTORY_ADDRESS,
                    ) &&
                    isConnected &&
                    isArcTestnet,
            },
        });

    /*
     * Read factory access-control state.
     *
     * If whitelist mode is disabled,
     * every wallet is eligible from the
     * factory's perspective.
     */
    const {
        data:
        creationWhitelisted,
    } =
        useReadContract({
            address:
                MARKET_FACTORY_ADDRESS,

            abi:
                MARKET_FACTORY_ABI,

            functionName:
                "creationWhitelisted",

            chainId:
                ARC_TESTNET_CHAIN_ID,

            query: {
                enabled:
                    Boolean(
                        MARKET_FACTORY_ADDRESS,
                    ),
            },
        });

    const {
        data:
        creatorAllowed,
    } =
        useReadContract({
            address:
                MARKET_FACTORY_ADDRESS,

            abi:
                MARKET_FACTORY_ABI,

            functionName:
                "creators",

            args:
                address
                    ? [
                        address,
                    ]
                    : undefined,

            chainId:
                ARC_TESTNET_CHAIN_ID,

            query: {
                enabled:
                    Boolean(
                        MARKET_FACTORY_ADDRESS,
                    ) &&
                    Boolean(
                        address,
                    ) &&
                    creationWhitelisted ===
                    true,
            },
        });

    const usdcBalance =
        typeof usdcBalanceRaw ===
            "bigint"
            ? Number(
                formatUnits(
                    usdcBalanceRaw,
                    6,
                ),
            )
            : 0;

    const hasEnoughUsdc =
        usdcBalance >=
        SEED_USDC;

    const whitelistAllows =
        creationWhitelisted !==
        true ||
        creatorAllowed ===
        true;

    const closeTimestamp =
        useMemo(
            () => {
                if (
                    !closeDate
                ) {
                    return null;
                }

                const parsed =
                    new Date(
                        closeDate,
                    );

                if (
                    Number.isNaN(
                        parsed.getTime(),
                    )
                ) {
                    return null;
                }

                return Math.floor(
                    parsed.getTime() /
                    1000,
                );
            },
            [
                closeDate,
            ],
        );

    const durationValid =
        closeTimestamp !==
        null &&
        closeTimestamp >
        Math.floor(
            Date.now() /
            1000,
        ) +
        3600;

    const formValid =
        question.trim()
            .length >=
        8 &&
        durationValid;

    const canCreate =
        Boolean(
            MARKET_FACTORY_ADDRESS,
        ) &&
        isConnected &&
        isArcTestnet &&
        hasEnoughUsdc &&
        whitelistAllows &&
        formValid &&
        status !==
        "approving" &&
        status !==
        "creating";

    async function handleCreate() {
        setError(
            null,
        );

        if (
            !MARKET_FACTORY_ADDRESS
        ) {
            setError(
                "Market factory address is not configured.",
            );

            return;
        }

        if (
            !address ||
            !isConnected
        ) {
            setError(
                "Connect your wallet first.",
            );

            return;
        }

        if (
            !isArcTestnet
        ) {
            try {
                await switchChainAsync({
                    chainId:
                        ARC_TESTNET_CHAIN_ID,
                });
            } catch (
            switchError
            ) {
                setError(
                    formatError(
                        switchError,
                    ),
                );

                return;
            }
        }

        if (
            !publicClient
        ) {
            setError(
                "Arc Testnet client is unavailable.",
            );

            return;
        }

        if (
            !hasEnoughUsdc
        ) {
            setError(
                `You need at least ${SEED_USDC} USDC to seed a market.`,
            );

            return;
        }

        if (
            !whitelistAllows
        ) {
            setError(
                "This wallet is not approved to create markets.",
            );

            return;
        }

        if (
            !formValid ||
            !closeTimestamp
        ) {
            setError(
                "Enter a valid question and a closing time at least one hour from now.",
            );

            return;
        }

        const seedAmount =
            parseUnits(
                SEED_USDC.toString(),
                6,
            );

        const allowance =
            typeof allowanceRaw ===
                "bigint"
                ? allowanceRaw
                : BigInt(0);

        try {
            /*
             * STEP 1
             * Approve the factory to pull
             * the 15 USDC seed.
             */
            if (
                allowance <
                seedAmount
            ) {
                setStatus(
                    "approving",
                );

                const hash =
                    await writeContractAsync({
                        address:
                            ARC_TESTNET_USDC,

                        abi:
                            ERC20_ABI,

                        functionName:
                            "approve",

                        args: [
                            MARKET_FACTORY_ADDRESS,
                            seedAmount,
                        ],

                        chainId:
                            ARC_TESTNET_CHAIN_ID,
                    });

                setApprovalHash(
                    hash,
                );

                const receipt =
                    await publicClient
                        .waitForTransactionReceipt({
                            hash,
                        });

                if (
                    receipt.status !==
                    "success"
                ) {
                    throw new Error(
                        "USDC approval failed.",
                    );
                }

                await refetchAllowance();
            }

            /*
             * STEP 2
             * Create the market.
             *
             * zeroAddress tells the factory
             * to use defaultOracle.
             */
            setStatus(
                "creating",
            );

            const hash =
                await writeContractAsync({
                    address:
                        MARKET_FACTORY_ADDRESS,

                    abi:
                        MARKET_FACTORY_ABI,

                    functionName:
                        "createMarket",

                    args: [
                        question.trim(),

                        BigInt(
                            closeTimestamp,
                        ),

                        seedAmount,

                        zeroAddress,
                    ],

                    chainId:
                        ARC_TESTNET_CHAIN_ID,
                });

            setCreateHash(
                hash,
            );

            const receipt =
                await publicClient
                    .waitForTransactionReceipt({
                        hash,
                    });

            if (
                receipt.status !==
                "success"
            ) {
                throw new Error(
                    "Market creation failed.",
                );
            }

            /*
             * Extract the newly-created
             * Market address from the
             * MarketCreated event.
             */
            const events =
                parseEventLogs({
                    abi:
                        MARKET_FACTORY_ABI,

                    logs:
                        receipt.logs,

                    eventName:
                        "MarketCreated",
                });

            const created =
                events[0]?.args
                    .market;

            if (
                !created
            ) {
                throw new Error(
                    "Market was created, but its address could not be read from the transaction.",
                );
            }

            setCreatedMarket(
                created,
            );

            setStatus(
                "success",
            );

            await refetchBalance();

            /*
             * Give the backend/indexer a
             * moment to discover it, then
             * navigate to the market page.
             */
            window.setTimeout(
                () => {
                    router.push(
                        `/markets/${created}`,
                    );
                },
                1800,
            );
        } catch (
        createError
        ) {
            console.error(
                "Failed to create market:",
                createError,
            );

            setStatus(
                "idle",
            );

            setError(
                formatError(
                    createError,
                ),
            );
        }
    }

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#f7f6f2] pb-24 pt-28">
            {/* Ambient background */}
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-[-220px] top-20 h-[520px] w-[520px] rounded-full bg-violet-300/10 blur-[165px]" />

                <div className="absolute right-[-220px] top-36 h-[520px] w-[520px] rounded-full bg-blue-300/10 blur-[165px]" />

                <div
                    className="absolute inset-0 opacity-[0.022]"
                    style={{
                        backgroundImage: `
                            linear-gradient(
                                to right,
                                rgba(99,102,241,0.18) 1px,
                                transparent 1px
                            ),
                            linear-gradient(
                                to bottom,
                                rgba(99,102,241,0.18) 1px,
                                transparent 1px
                            )
                        `,
                        backgroundSize:
                            "48px 48px",
                    }}
                />
            </div>

            <div className="relative mx-auto max-w-6xl px-6">
                <div className="flex items-center justify-between gap-4">
                    <Link
                        href="/markets"
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-500 transition-colors hover:text-violet-600"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />

                        Markets
                    </Link>

                    <MarketWalletButton
                        usdcBalance={usdcBalance}
                        usdcBalanceLoading={balanceLoading}
                    />
                </div>

                <motion.div
                    initial={
                        reduceMotion
                            ? {
                                opacity:
                                    1,
                            }
                            : {
                                opacity:
                                    0,

                                y:
                                    18,
                            }
                    }
                    animate={{
                        opacity:
                            1,

                        y:
                            0,
                    }}
                    transition={{
                        duration:
                            0.45,
                    }}
                    className="mt-12"
                >
                    <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5">
                        <Sparkles className="h-3 w-3 text-violet-600" />

                        <span className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-600">
                            Create market
                        </span>
                    </div>

                    <h1
                        className="mt-6 max-w-4xl text-[46px] font-black leading-[0.96] tracking-[-0.05em] text-slate-950 sm:text-[64px]"
                        style={{
                            fontFamily:
                                "var(--font-display)",
                        }}
                    >
                        Put a question{" "}
                        <span className="bg-gradient-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">
                            onchain.
                        </span>
                    </h1>

                    <p className="mt-5 max-w-2xl text-[15px] font-medium leading-[1.75] text-slate-500">
                        Seed a binary market with 15 USDC. Once live,
                        agents can research, reason, and trade against
                        the outcome.
                    </p>
                </motion.div>

                <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
                    {/* FORM */}
                    <div className="overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-500 to-blue-500 p-[2px] shadow-[0_30px_70px_-46px_rgba(99,102,241,0.45)]">
                        <div className="rounded-[26px] bg-[#fffdf8] p-6 sm:p-8">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-violet-50 text-violet-600">
                                    <FileQuestion className="h-4.5 w-4.5" />
                                </div>

                                <div>
                                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">
                                        Market details
                                    </p>

                                    <p className="mt-1 text-[13px] font-black text-slate-900">
                                        Define the prediction
                                    </p>
                                </div>
                            </div>

                            <div className="mt-7">
                                <label className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                                    Question
                                </label>

                                <textarea
                                    value={
                                        question
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setQuestion(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    maxLength={
                                        240
                                    }
                                    rows={
                                        4
                                    }
                                    placeholder="Will the Fed announce a rate cut in September 2026?"
                                    className="mt-2 w-full resize-none rounded-[16px] border border-black/10 bg-white px-4 py-4 text-[14px] font-semibold leading-6 text-slate-900 outline-none transition-colors placeholder:text-slate-300 focus:border-violet-300"
                                />

                                <p className="mt-2 text-right font-mono text-[8px] font-semibold text-slate-400">
                                    {
                                        question.length
                                    }
                                    /240
                                </p>
                            </div>

                            <div className="mt-5">
                                <label className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">
                                    Trading closes
                                </label>

                                <div className="relative mt-2">
                                    <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-500" />

                                    <input
                                        type="datetime-local"
                                        value={
                                            closeDate
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            setCloseDate(
                                                event
                                                    .target
                                                    .value,
                                            )
                                        }
                                        className="h-14 w-full rounded-[16px] border border-black/10 bg-white pl-11 pr-4 font-mono text-[12px] font-black text-slate-700 outline-none transition-colors focus:border-violet-300"
                                    />
                                </div>

                                <p className="mt-2 flex items-center gap-1.5 text-[8px] font-semibold text-slate-400">
                                    <Clock3 className="h-3 w-3" />

                                    Must be at least one hour from now.
                                </p>
                            </div>

                            <div className="mt-6 rounded-[18px] border border-violet-100 bg-violet-50/60 p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Coins className="h-4 w-4 text-violet-600" />

                                        <span className="text-[9px] font-black text-slate-700">
                                            Initial liquidity
                                        </span>
                                    </div>

                                    <span className="font-mono text-[15px] font-black text-violet-700">
                                        15.00 USDC
                                    </span>
                                </div>

                                <p className="mt-2 text-[8px] font-medium leading-4 text-slate-400">
                                    This seed becomes the initial liquidity for
                                    the market. It is transferred to the market
                                    contract when creation succeeds.
                                </p>
                            </div>

                            {error && (
                                <div className="mt-5 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3">
                                    <p className="text-[9px] font-semibold leading-5 text-rose-700">
                                        {
                                            error
                                        }
                                    </p>
                                </div>
                            )}

                            {status ===
                                "approving" &&
                                approvalHash && (
                                    <TxRow
                                        label="USDC approval"
                                        hash={
                                            approvalHash
                                        }
                                    />
                                )}

                            {(status ===
                                "creating" ||
                                status ===
                                "success") &&
                                createHash && (
                                    <TxRow
                                        label={
                                            status ===
                                                "success"
                                                ? "Market created"
                                                : "Creating market"
                                        }
                                        hash={
                                            createHash
                                        }
                                    />
                                )}

                            <motion.button
                                type="button"
                                onClick={() => {
                                    void handleCreate();
                                }}
                                disabled={
                                    !canCreate
                                }
                                whileHover={
                                    canCreate
                                        ? {
                                            y:
                                                -2,
                                        }
                                        : undefined
                                }
                                whileTap={
                                    canCreate
                                        ? {
                                            scale:
                                                0.98,
                                        }
                                        : undefined
                                }
                                className="mt-6 flex w-full items-center justify-center gap-2 rounded-[15px] bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-4 text-[10px] font-black uppercase tracking-[0.13em] text-white shadow-lg shadow-violet-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {status ===
                                    "approving"
                                    ? "Approving 15 USDC..."
                                    : status ===
                                        "creating"
                                        ? "Creating market..."
                                        : status ===
                                            "success"
                                            ? "Market created"
                                            : "Create market"}

                                {status ===
                                    "success" ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    <ArrowRight className="h-4 w-4" />
                                )}
                            </motion.button>
                        </div>
                    </div>

                    {/* SIDEBAR */}
                    <aside className="space-y-4">
                        <div className="rounded-[22px] border border-black/10 bg-[#fffdf8]/80 p-5">
                            <div className="flex items-center gap-2">
                                <WalletCards className="h-4 w-4 text-violet-600" />

                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-700">
                                    Creator access
                                </p>
                            </div>

                            <div className="mt-5 space-y-4">
                                <AccessRow
                                    label="Wallet"
                                    value={
                                        isConnected
                                            ? "Connected"
                                            : "Required"
                                    }
                                    good={
                                        isConnected
                                    }
                                />

                                <AccessRow
                                    label="Network"
                                    value={
                                        isArcTestnet
                                            ? "Arc Testnet"
                                            : "Switch required"
                                    }
                                    good={
                                        isArcTestnet
                                    }
                                />

                                <AccessRow
                                    label="USDC balance"
                                    value={
                                        balanceLoading
                                            ? "Loading..."
                                            : `${usdcBalance.toFixed(
                                                2,
                                            )} USDC`
                                    }
                                    good={
                                        hasEnoughUsdc
                                    }
                                />

                                <AccessRow
                                    label="Required seed"
                                    value="15.00 USDC"
                                    good={
                                        hasEnoughUsdc
                                    }
                                />

                                {creationWhitelisted ===
                                    true && (
                                        <AccessRow
                                            label="Creator permission"
                                            value={
                                                creatorAllowed
                                                    ? "Approved"
                                                    : "Not approved"
                                            }
                                            good={
                                                creatorAllowed ===
                                                true
                                            }
                                        />
                                    )}
                            </div>
                        </div>

                        <div className="rounded-[22px] border border-black/10 bg-[#fffdf8]/80 p-5">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-violet-600" />

                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-700">
                                    What happens next
                                </p>
                            </div>

                            <div className="mt-4 space-y-3">
                                {[
                                    "15 USDC seeds initial liquidity",
                                    "Trading opens immediately after deployment",
                                    "Agents discover the market automatically",
                                    "Factory default oracle handles resolution",
                                ].map(
                                    (
                                        item,
                                    ) => (
                                        <div
                                            key={
                                                item
                                            }
                                            className="flex items-start gap-2 text-[9px] font-semibold leading-5 text-slate-500"
                                        >
                                            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />

                                            {
                                                item
                                            }
                                        </div>
                                    ),
                                )}
                            </div>
                        </div>

                        {createdMarket && (
                            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-5">
                                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-600">
                                    Live on Arc
                                </p>

                                <p className="mt-2 break-all font-mono text-[9px] font-black text-emerald-800">
                                    {
                                        createdMarket
                                    }
                                </p>

                                <p className="mt-3 text-[8px] font-semibold text-emerald-600">
                                    Redirecting to your market…
                                </p>
                            </div>
                        )}
                    </aside>
                </section>
            </div>
        </main>
    );
}

function AccessRow({
    label,
    value,
    good,
}: {
    label:
    string;

    value:
    string;

    good:
    boolean;
}) {
    return (
        <div className="flex items-center justify-between gap-4 border-b border-black/5 pb-3 last:border-0 last:pb-0">
            <span className="text-[9px] font-semibold text-slate-400">
                {label}
            </span>

            <span
                className={`font-mono text-[9px] font-black ${good
                    ? "text-emerald-600"
                    : "text-slate-500"
                    }`}
            >
                {value}
            </span>
        </div>
    );
}

function TxRow({
    label,
    hash,
}: {
    label:
    string;

    hash:
    `0x${string}`;
}) {
    return (
        <a
            href={`${ARC_TESTNET_EXPLORER}/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-between rounded-[12px] border border-blue-200 bg-blue-50 px-3 py-3"
        >
            <span>
                <span className="block text-[8px] font-black text-blue-800">
                    {label}
                </span>

                <span className="mt-1 block font-mono text-[8px] font-semibold text-blue-600">
                    {hash.slice(
                        0,
                        8,
                    )}
                    …
                    {hash.slice(
                        -6,
                    )}
                </span>
            </span>

            <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
        </a>
    );
}