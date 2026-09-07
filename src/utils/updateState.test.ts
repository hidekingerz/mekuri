import { describe, expect, it } from "vitest";
import {
  INITIAL_UPDATE_STATE,
  type UpdateInfo,
  type UpdateState,
  updateReducer,
} from "./updateState";

const update: UpdateInfo = { version: "1.9.0", notes: "notes" };
const available: UpdateState = { status: "available", update };
const downloading: UpdateState = { status: "downloading", update, downloaded: 10, total: 100 };
const ready: UpdateState = { status: "ready", update };

describe("updateReducer", () => {
  it("starts in idle", () => {
    expect(INITIAL_UPDATE_STATE).toEqual({ status: "idle" });
  });

  describe("CHECK_STARTED", () => {
    it("moves idle to checking with the manual flag", () => {
      expect(updateReducer({ status: "idle" }, { type: "CHECK_STARTED", manual: true })).toEqual({
        status: "checking",
        manual: true,
      });
      expect(updateReducer({ status: "idle" }, { type: "CHECK_STARTED", manual: false })).toEqual({
        status: "checking",
        manual: false,
      });
    });

    it("can start from available, upToDate and error", () => {
      for (const from of [
        available,
        { status: "upToDate" } as UpdateState,
        { status: "error", message: "x", retry: "check" } as UpdateState,
      ]) {
        expect(updateReducer(from, { type: "CHECK_STARTED", manual: true })).toEqual({
          status: "checking",
          manual: true,
        });
      }
    });

    it("is ignored while downloading or ready", () => {
      expect(updateReducer(downloading, { type: "CHECK_STARTED", manual: true })).toBe(downloading);
      expect(updateReducer(ready, { type: "CHECK_STARTED", manual: true })).toBe(ready);
    });
  });

  describe("check results", () => {
    it("CHECK_FOUND moves checking to available", () => {
      expect(
        updateReducer({ status: "checking", manual: false }, { type: "CHECK_FOUND", update }),
      ).toEqual(available);
    });

    it("CHECK_NONE on a manual check shows upToDate", () => {
      expect(updateReducer({ status: "checking", manual: true }, { type: "CHECK_NONE" })).toEqual({
        status: "upToDate",
      });
    });

    it("CHECK_NONE on an automatic check returns to idle", () => {
      expect(updateReducer({ status: "checking", manual: false }, { type: "CHECK_NONE" })).toEqual({
        status: "idle",
      });
    });

    it("CHECK_FAILED on a manual check shows an error with check retry", () => {
      expect(
        updateReducer(
          { status: "checking", manual: true },
          { type: "CHECK_FAILED", message: "offline" },
        ),
      ).toEqual({ status: "error", message: "offline", retry: "check" });
    });

    it("CHECK_FAILED on an automatic check returns to idle", () => {
      expect(
        updateReducer(
          { status: "checking", manual: false },
          { type: "CHECK_FAILED", message: "offline" },
        ),
      ).toEqual({ status: "idle" });
    });

    it("check results are ignored outside checking", () => {
      expect(updateReducer(available, { type: "CHECK_NONE" })).toBe(available);
      expect(updateReducer(downloading, { type: "CHECK_FOUND", update })).toBe(downloading);
      expect(updateReducer({ status: "idle" }, { type: "CHECK_FAILED", message: "x" })).toEqual({
        status: "idle",
      });
    });
  });

  describe("download", () => {
    it("DOWNLOAD_STARTED moves available to downloading with zero progress", () => {
      expect(updateReducer(available, { type: "DOWNLOAD_STARTED" })).toEqual({
        status: "downloading",
        update,
        downloaded: 0,
        total: null,
      });
    });

    it("DOWNLOAD_STARTED is ignored outside available", () => {
      expect(updateReducer({ status: "idle" }, { type: "DOWNLOAD_STARTED" })).toEqual({
        status: "idle",
      });
      expect(updateReducer(downloading, { type: "DOWNLOAD_STARTED" })).toBe(downloading);
    });

    it("DOWNLOAD_PROGRESS updates downloaded and total", () => {
      expect(
        updateReducer(downloading, { type: "DOWNLOAD_PROGRESS", downloaded: 50, total: 200 }),
      ).toEqual({ status: "downloading", update, downloaded: 50, total: 200 });
    });

    it("DOWNLOAD_PROGRESS is ignored outside downloading", () => {
      expect(
        updateReducer(available, { type: "DOWNLOAD_PROGRESS", downloaded: 50, total: 200 }),
      ).toBe(available);
    });

    it("DOWNLOAD_FINISHED moves downloading to ready", () => {
      expect(updateReducer(downloading, { type: "DOWNLOAD_FINISHED" })).toEqual(ready);
    });

    it("DOWNLOAD_FAILED keeps the update so it can be retried", () => {
      expect(updateReducer(downloading, { type: "DOWNLOAD_FAILED", message: "bad sig" })).toEqual({
        status: "error",
        message: "bad sig",
        retry: "install",
        update,
      });
    });

    it("RETRY_INSTALL restores available from an install error", () => {
      const err: UpdateState = { status: "error", message: "x", retry: "install", update };
      expect(updateReducer(err, { type: "RETRY_INSTALL" })).toEqual(available);
    });

    it("RETRY_INSTALL is ignored for other errors and states", () => {
      const checkErr: UpdateState = { status: "error", message: "x", retry: "check" };
      expect(updateReducer(checkErr, { type: "RETRY_INSTALL" })).toBe(checkErr);
      expect(updateReducer(available, { type: "RETRY_INSTALL" })).toBe(available);
    });
  });

  describe("relaunch", () => {
    it("RELAUNCH_FAILED moves ready to a non-retryable error", () => {
      expect(updateReducer(ready, { type: "RELAUNCH_FAILED", message: "nope" })).toEqual({
        status: "error",
        message: "nope",
        retry: null,
      });
    });

    it("RELAUNCH_FAILED is ignored outside ready", () => {
      expect(updateReducer(available, { type: "RELAUNCH_FAILED", message: "nope" })).toBe(
        available,
      );
    });
  });

  describe("DISMISS", () => {
    it("returns available, upToDate and error to idle", () => {
      for (const from of [
        available,
        { status: "upToDate" } as UpdateState,
        { status: "error", message: "x", retry: null } as UpdateState,
      ]) {
        expect(updateReducer(from, { type: "DISMISS" })).toEqual({ status: "idle" });
      }
    });

    it("is ignored while checking, downloading and ready", () => {
      const checking: UpdateState = { status: "checking", manual: true };
      expect(updateReducer(checking, { type: "DISMISS" })).toBe(checking);
      expect(updateReducer(downloading, { type: "DISMISS" })).toBe(downloading);
      expect(updateReducer(ready, { type: "DISMISS" })).toBe(ready);
    });
  });
});
