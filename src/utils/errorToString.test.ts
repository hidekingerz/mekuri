import { describe, expect, it } from "vitest";
import { errorToString } from "./errorToString";

describe("errorToString", () => {
  it("returns message from Error instance", () => {
    expect(errorToString(new Error("something went wrong"))).toBe("something went wrong");
  });

  it("returns string as-is", () => {
    expect(errorToString("plain string error")).toBe("plain string error");
  });

  it("converts number to string", () => {
    expect(errorToString(42)).toBe("42");
  });

  it("converts null to string", () => {
    expect(errorToString(null)).toBe("null");
  });

  it("converts undefined to string", () => {
    expect(errorToString(undefined)).toBe("undefined");
  });

  it("converts object to string", () => {
    expect(errorToString({ code: 404 })).toBe("[object Object]");
  });
});
