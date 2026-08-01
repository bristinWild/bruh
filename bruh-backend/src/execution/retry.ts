export interface RetryOptions {
    maximumAttempts: number;

    initialDelayMs: number;

    maximumDelayMs: number;

    multiplier: number;

    shouldRetry?: (
        error: unknown,
        attempt: number,
    ) => boolean;
}

export interface RetryResult<T> {
    value: T;

    attempts: number;
}

export async function withRetry<T>(
    operation: (
        attempt: number,
    ) => Promise<T>,

    options: RetryOptions,
): Promise<RetryResult<T>> {
    let lastError: unknown;

    for (
        let attempt = 1;
        attempt <=
        options.maximumAttempts;
        attempt += 1
    ) {
        try {
            const value =
                await operation(attempt);

            return {
                value,
                attempts: attempt,
            };
        } catch (error) {
            lastError = error;

            const retryable =
                options.shouldRetry?.(
                    error,
                    attempt,
                ) ?? true;

            const finalAttempt =
                attempt ===
                options.maximumAttempts;

            if (
                !retryable ||
                finalAttempt
            ) {
                throw error;
            }

            const delayMs =
                Math.min(
                    options.maximumDelayMs,

                    options.initialDelayMs *
                    options.multiplier **
                    (attempt - 1),
                );

            await delay(delayMs);
        }
    }

    throw lastError;
}

function delay(
    milliseconds: number,
): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(
            resolve,
            milliseconds,
        );
    });
}