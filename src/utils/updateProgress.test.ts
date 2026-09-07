import { describe, expect, it } from "vitest";
import { accumulateProgress, downloadPercent, INITIAL_PROGRESS } from "./updateProgress";

describe("accumulateProgress", () => {
  it("starts with nothing downloaded and unknown total", () => {
    expect(INITIAL_PROGRESS).toEqual({ downloaded: 0, total: null });
  });

  it("Started sets the total from contentLength", () => {
    expect(
      accumulateProgress(INITIAL_PROGRESS, { event: "Started", data: { contentLength: 1000 } }),
    ).toEqual({ downloaded: 0, total: 1000 });
  });

  it("Started without contentLength keeps total unknown", () => {
    expect(accumulateProgress(INITIAL_PROGRESS, { event: "Started", data: {} })).toEqual({
      downloaded: 0,
      total: null,
    });
  });

  it("Progress accumulates chunk lengths", () => {
    const afterStart = accumulateProgress(INITIAL_PROGRESS, {
      event: "Started",
      data: { contentLength: 1000 },
    });
    const first = accumulateProgress(afterStart, { event: "Progress", data: { chunkLength: 300 } });
    const second = accumulateProgress(first, { event: "Progress", data: { chunkLength: 200 } });
    expect(first).toEqual({ downloaded: 300, total: 1000 });
    expect(second).toEqual({ downloaded: 500, total: 1000 });
  });

  it("Finished snaps downloaded to total when total is known", () => {
    expect(accumulateProgress({ downloaded: 900, total: 1000 }, { event: "Finished" })).toEqual({
      downloaded: 1000,
      total: 1000,
    });
  });

  it("Finished keeps downloaded when total is unknown", () => {
    expect(accumulateProgress({ downloaded: 900, total: null }, { event: "Finished" })).toEqual({
      downloaded: 900,
      total: null,
    });
  });
});

describe("downloadPercent", () => {
  it("returns null when total is null", () => {
    expect(downloadPercent({ downloaded: 10, total: null })).toBeNull();
  });

  it("returns null when total is zero", () => {
    expect(downloadPercent({ downloaded: 0, total: 0 })).toBeNull();
  });

  it("returns the floored percentage", () => {
    expect(downloadPercent({ downloaded: 45, total: 100 })).toBe(45);
  });

  it("clamps to 100 when downloaded exceeds total", () => {
    expect(downloadPercent({ downloaded: 150, total: 100 })).toBe(100);
  });
});
