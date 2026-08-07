import {
    Injectable,
} from "@nestjs/common";

import {
    Observable,
    Subject,
} from "rxjs";

import type {
    MarketActivity,
} from "./markets.types";

export type MarketStreamEvent =
    | {
        type:
        "MARKET_TRADE";

        market:
        string;

        source:
        | "pending"
        | "indexed";

        activity:
        MarketActivity;
    }

    | {
        type:
        "HEARTBEAT";

        market:
        string;

        timestamp:
        string;
    };

export type MarketStreamMessage = {
    data:
    MarketStreamEvent;

    id?: string;

    retry?: number;
};

@Injectable()
export class MarketStreamService {
    private readonly channels =
        new Map<
            string,
            Subject<MarketStreamMessage>
        >();

    private readonly subscribers =
        new Map<
            string,
            number
        >();

    stream(
        address: string,
    ): Observable<MarketStreamMessage> {
        const market =
            address.toLowerCase();

        return new Observable(
            (
                subscriber,
            ) => {
                const channel =
                    this.getChannel(
                        market,
                    );

                const count =
                    this.subscribers.get(
                        market,
                    ) ?? 0;

                this.subscribers.set(
                    market,
                    count + 1,
                );

                const subscription =
                    channel.subscribe(
                        subscriber,
                    );

                /*
                 * Keep SSE connections alive
                 * through proxies / platforms.
                 */
                const heartbeat =
                    setInterval(
                        () => {
                            subscriber.next(
                                {
                                    data: {
                                        type:
                                            "HEARTBEAT",

                                        market,

                                        timestamp:
                                            new Date()
                                                .toISOString(),
                                    },
                                },
                            );
                        },
                        15_000,
                    );

                return () => {
                    clearInterval(
                        heartbeat,
                    );

                    subscription.unsubscribe();

                    const remaining =
                        (
                            this.subscribers.get(
                                market,
                            ) ?? 1
                        ) - 1;

                    if (
                        remaining <=
                        0
                    ) {
                        this.subscribers.delete(
                            market,
                        );

                        channel.complete();

                        this.channels.delete(
                            market,
                        );
                    } else {
                        this.subscribers.set(
                            market,
                            remaining,
                        );
                    }
                };
            },
        );
    }

    publishTrade(
        address: string,
        activity:
            MarketActivity,
        source:
            | "pending"
            | "indexed",
    ): void {
        const market =
            address.toLowerCase();

        /*
         * Don't create channels when
         * nobody is listening.
         */
        const channel =
            this.channels.get(
                market,
            );

        if (!channel) {
            return;
        }

        channel.next({
            id:
                activity.transactionHash,

            data: {
                type:
                    "MARKET_TRADE",

                market,

                source,

                activity,
            },
        });
    }

    private getChannel(
        market: string,
    ): Subject<MarketStreamMessage> {
        const existing =
            this.channels.get(
                market,
            );

        if (existing) {
            return existing;
        }

        const channel =
            new Subject<
                MarketStreamMessage
            >();

        this.channels.set(
            market,
            channel,
        );

        return channel;
    }
}