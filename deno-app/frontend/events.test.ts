import { assertEquals } from "@std/assert";
import {
  dispatchPushMessage,
  EVENT_CHANNEL,
  EVENTS_PATH,
  type EventSourceLike,
  MENU_CLICK_CHANNEL,
  type PushDeliveryHost,
  subscribeEvents,
} from "./events.ts";
import {
  EVENT_CHANNEL as DESKTOP_EVENT_CHANNEL,
  EVENTS_PATH as DESKTOP_EVENTS_PATH,
  MENU_CLICK_CHANNEL as DESKTOP_MENU_CLICK_CHANNEL,
} from "../desktop/pushHub.ts";

Deno.test("channel constants and path match desktop/pushHub.ts", () => {
  // frontend の定数は SSE 配信側（desktop/pushHub.ts）と必ず一致させること。
  assertEquals(EVENTS_PATH, DESKTOP_EVENTS_PATH);
  assertEquals(EVENT_CHANNEL, DESKTOP_EVENT_CHANNEL);
  assertEquals(MENU_CLICK_CHANNEL, DESKTOP_MENU_CLICK_CHANNEL);
});

Deno.test("dispatchPushMessage routes EVENT_CHANNEL to __mekuriDeliverEvent", () => {
  const calls: Array<{ event: string; payload: unknown }> = [];
  const host: PushDeliveryHost = {
    __mekuriDeliverEvent: (event, payload) => calls.push({ event, payload }),
  };
  dispatchPushMessage(
    JSON.stringify({
      channel: EVENT_CHANNEL,
      data: { event: "folder-selected", payload: { path: "/a.zip" } },
    }),
    host,
  );
  assertEquals(calls, [{
    event: "folder-selected",
    payload: { path: "/a.zip" },
  }]);
});

Deno.test("dispatchPushMessage routes MENU_CLICK_CHANNEL to __mekuriMenuClick", () => {
  const ids: string[] = [];
  const host: PushDeliveryHost = {
    __mekuriMenuClick: (id) => ids.push(id),
  };
  dispatchPushMessage(
    JSON.stringify({
      channel: MENU_CLICK_CHANNEL,
      data: { id: "mekuri-menu-3" },
    }),
    host,
  );
  assertEquals(ids, ["mekuri-menu-3"]);
});

Deno.test("dispatchPushMessage ignores invalid JSON", () => {
  let touched = false;
  const host: PushDeliveryHost = {
    __mekuriDeliverEvent: () => (touched = true),
    __mekuriMenuClick: () => (touched = true),
  };
  dispatchPushMessage("not json", host);
  assertEquals(touched, false);
});

Deno.test("dispatchPushMessage ignores unknown channels", () => {
  let touched = false;
  const host: PushDeliveryHost = {
    __mekuriDeliverEvent: () => (touched = true),
    __mekuriMenuClick: () => (touched = true),
  };
  dispatchPushMessage(
    JSON.stringify({ channel: "other", data: { id: "x" } }),
    host,
  );
  assertEquals(touched, false);
});

Deno.test("dispatchPushMessage ignores event messages without a string event", () => {
  let touched = false;
  const host: PushDeliveryHost = {
    __mekuriDeliverEvent: () => (touched = true),
  };
  dispatchPushMessage(
    JSON.stringify({ channel: EVENT_CHANNEL, data: { payload: 1 } }),
    host,
  );
  assertEquals(touched, false);
});

Deno.test("dispatchPushMessage ignores menu messages without a string id", () => {
  let touched = false;
  const host: PushDeliveryHost = {
    __mekuriMenuClick: () => (touched = true),
  };
  dispatchPushMessage(
    JSON.stringify({ channel: MENU_CLICK_CHANNEL, data: {} }),
    host,
  );
  assertEquals(touched, false);
});

Deno.test("subscribeEvents builds the URL with an encoded label and wires onmessage", () => {
  let createdUrl = "";
  let closed = false;
  const source: EventSourceLike = {
    onmessage: null,
    close: () => (closed = true),
  };
  const factory = (url: string): EventSourceLike => {
    createdUrl = url;
    return source;
  };
  const ids: string[] = [];
  const host: PushDeliveryHost = { __mekuriMenuClick: (id) => ids.push(id) };

  const unsubscribe = subscribeEvents("viewer-abc", factory, host);
  assertEquals(createdUrl, `${EVENTS_PATH}?windowLabel=viewer-abc`);

  // 配線された onmessage が dispatchPushMessage を通すこと。
  source.onmessage?.({
    data: JSON.stringify({
      channel: MENU_CLICK_CHANNEL,
      data: { id: "mekuri-menu-1" },
    }),
  });
  assertEquals(ids, ["mekuri-menu-1"]);

  unsubscribe();
  assertEquals(closed, true);
});

Deno.test("subscribeEvents percent-encodes labels with reserved characters", () => {
  let createdUrl = "";
  const factory = (url: string): EventSourceLike => {
    createdUrl = url;
    return { onmessage: null, close: () => {} };
  };
  subscribeEvents("viewer-a&b", factory, {});
  assertEquals(createdUrl, `${EVENTS_PATH}?windowLabel=viewer-a%26b`);
});
