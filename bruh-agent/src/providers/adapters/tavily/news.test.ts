import {
    describe,
    expect,
    it,
} from "vitest";

import {
    TavilyNewsAdapter,
    TavilyNewsAdapterError,
} from "./news";

describe("TavilyNewsAdapter", () => {
    it("rejects an empty API key", () => {
        expect(
            () =>
                new TavilyNewsAdapter({
                    apiKey: "",
                }),
        ).toThrow(
            TavilyNewsAdapterError,
        );
    });

    it("rejects more than 20 results", () => {
        expect(
            () =>
                new TavilyNewsAdapter({
                    apiKey: "tvly-test",
                    maximumResults: 21,
                }),
        ).toThrow(
            TavilyNewsAdapterError,
        );
    });
});