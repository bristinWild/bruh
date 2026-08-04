import {
    describe,
    expect,
    it,
} from "vitest";

import {
    SupabaseHistoricalAdapter,
    SupabaseHistoricalAdapterError,
} from "./historical";

describe(
    "SupabaseHistoricalAdapter",
    () => {
        it(
            "rejects an empty Supabase URL",
            () => {
                expect(
                    () =>
                        new SupabaseHistoricalAdapter({
                            url: "",
                            serviceRoleKey:
                                "service-role-test",
                        }),
                ).toThrow(
                    SupabaseHistoricalAdapterError,
                );
            },
        );

        it(
            "rejects an empty service-role key",
            () => {
                expect(
                    () =>
                        new SupabaseHistoricalAdapter({
                            url:
                                "https://example.supabase.co",

                            serviceRoleKey: "",
                        }),
                ).toThrow(
                    SupabaseHistoricalAdapterError,
                );
            },
        );

        it(
            "rejects an invalid similarity score",
            () => {
                expect(
                    () =>
                        new SupabaseHistoricalAdapter({
                            url:
                                "https://example.supabase.co",

                            serviceRoleKey:
                                "service-role-test",

                            minimumSimilarityScore:
                                1.5,
                        }),
                ).toThrow(
                    SupabaseHistoricalAdapterError,
                );
            },
        );
    },
);