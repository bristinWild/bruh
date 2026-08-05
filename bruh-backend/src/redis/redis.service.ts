import {
    Injectable,
    Logger,
    OnModuleDestroy,
} from "@nestjs/common";

import {
    ConfigService,
} from "@nestjs/config";

import Redis from "ioredis";

@Injectable()
export class RedisService
    implements OnModuleDestroy {
    private readonly logger =
        new Logger(
            RedisService.name,
        );

    private readonly client:
        Redis | null;

    constructor(
        private readonly config:
            ConfigService,
    ) {
        const redisUrl =
            this.config.get<string>(
                "REDIS_URL",
            );

        if (!redisUrl) {
            this.logger.warn(
                "REDIS_URL is not configured. Redis cache is disabled.",
            );

            this.client =
                null;

            return;
        }

        const connectionUrl =
            redisUrl.includes("?")
                ? `${redisUrl}&family=0`
                : `${redisUrl}?family=0`;

        this.client =
            new Redis(
                connectionUrl,
                {
                    maxRetriesPerRequest:
                        1,

                    enableOfflineQueue:
                        false,

                    lazyConnect:
                        true,
                },
            );

        this.client.on(
            "error",
            (error) => {
                this.logger.warn(
                    `Redis error: ${error.message}`,
                );
            },
        );
    }

    async getJson<T>(
        key: string,
    ): Promise<T | null> {
        if (!this.client) {
            return null;
        }

        try {
            if (
                this.client.status ===
                "wait"
            ) {
                await this.client.connect();
            }

            const value =
                await this.client.get(
                    key,
                );

            return value
                ? (JSON.parse(
                    value,
                ) as T)
                : null;
        } catch (error) {
            this.logger.warn(
                `Redis GET failed for ${key}: ${error instanceof Error
                    ? error.message
                    : "Unknown error"
                }`,
            );

            return null;
        }
    }

    async setJson(
        key: string,
        value: unknown,
        ttlSeconds: number,
    ): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            if (
                this.client.status ===
                "wait"
            ) {
                await this.client.connect();
            }

            await this.client.set(
                key,
                JSON.stringify(
                    value,
                ),
                "EX",
                ttlSeconds,
            );
        } catch (error) {
            this.logger.warn(
                `Redis SET failed for ${key}: ${error instanceof Error
                    ? error.message
                    : "Unknown error"
                }`,
            );
        }
    }

    async delete(
        key: string,
    ): Promise<void> {
        if (!this.client) {
            return;
        }

        try {
            await this.client.del(
                key,
            );
        } catch (error) {
            this.logger.warn(
                `Redis DEL failed for ${key}: ${error instanceof Error
                    ? error.message
                    : "Unknown error"
                }`,
            );
        }
    }

    async onModuleDestroy() {
        if (
            this.client &&
            this.client.status !==
            "end"
        ) {
            this.client.disconnect();
        }
    }
}