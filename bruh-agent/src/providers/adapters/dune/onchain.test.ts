import {
    describe,
    expect,
    it,
} from "vitest";

import {
    DuneOnchainAdapter,
    DuneOnchainAdapterError,
} from "./onchain";

describe("DuneOnchainAdapter", () => {
    it("rejects an empty API key", () => {
        expect(
            () =>
                new DuneOnchainAdapter({
                    apiKey: "",
                    queryIds: {},
                }),
        ).toThrow(
            DuneOnchainAdapterError,
        );
    });

    it("rejects an invalid query ID", () => {
        expect(
            () =>
                new DuneOnchainAdapter({
                    apiKey: "test-key",

                    queryIds: {
                        whaleTransfers: -1,
                    },
                }),
        ).toThrow(
            DuneOnchainAdapterError,
        );
    });

    it("allows partially configured queries", () => {
        expect(
            () =>
                new DuneOnchainAdapter({
                    apiKey: "test-key",

                    queryIds: {
                        whaleTransfers: 123,
                    },
                }),
        ).not.toThrow();
    });
});