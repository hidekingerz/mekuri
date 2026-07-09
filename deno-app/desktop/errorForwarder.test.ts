import { assertStringIncludes } from "@std/assert";
import { errorForwarderScript } from "./errorForwarder.ts";

Deno.test("errorForwarderScript wraps the forwarder in a <script> tag", () => {
  const script = errorForwarderScript();
  assertStringIncludes(script, "<script>");
  assertStringIncludes(script, "</script>");
});

Deno.test("errorForwarderScript posts to the /__log endpoint", () => {
  assertStringIncludes(errorForwarderScript(), "/__log?m=");
});

Deno.test("errorForwarderScript listens for error and unhandledrejection", () => {
  const script = errorForwarderScript();
  assertStringIncludes(script, "addEventListener('error'");
  assertStringIncludes(script, "addEventListener('unhandledrejection'");
});

Deno.test("errorForwarderScript emits the reject: prefix for rejections", () => {
  assertStringIncludes(errorForwarderScript(), "reject: ");
});

Deno.test("errorForwarderScript describes the reason name, message and stack", () => {
  const script = errorForwarderScript();
  // reason.name / reason.message / reason.stack を連結して出すこと（位置情報だけの
  // `@user-script:…` で message が欠落する webview への対策）。
  assertStringIncludes(script, "r.name");
  assertStringIncludes(script, "r.message");
  assertStringIncludes(script, "r.stack");
});
