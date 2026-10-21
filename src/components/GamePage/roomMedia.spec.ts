import SimplePeer from "simple-peer";
import { MediaSocket, RemoteMedia, RoomMedia } from "./roomMedia";

jest.mock("simple-peer", () => jest.fn());
const createMockPeer = (options: MockPeer["options"]) => {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const peer: MockPeer & { on: jest.Mock } = {
    options,
    destroyed: false,
    on: jest.fn((event: string, callback: (...args: unknown[]) => void) => {
      (listeners[event] ||= []).push(callback);
      return peer;
    }),
    fire: (event: string, ...args: unknown[]) => {
      listeners[event]?.forEach((callback) => callback(...args));
    },
    signal: jest.fn(),
    destroy: jest.fn(() => {
      peer.destroyed = true;
      peer.fire("close");
    }),
  };
  return peer;
};
interface MockPeer {
  options: { initiator: boolean; stream?: MediaStream };
  destroyed: boolean;
  fire(event: string, ...args: unknown[]): void;
  signal: jest.Mock;
  destroy: jest.Mock;
}
const peers = () =>
  (SimplePeer as unknown as jest.Mock).mock.results.map(
    (item) => item.value as MockPeer
  );
const stream = (video = true, audio = false) =>
  ({
    getVideoTracks: () => (video ? [{}] : []),
    getAudioTracks: () => (audio ? [{}] : []),
  } as unknown as MediaStream);
interface MockSocket {
  id: string;
  on: jest.Mock;
  off: jest.Mock;
  emit: jest.Mock;
  receive(payload: unknown): void;
}
let sockets: Record<string, MockSocket>;
function makeSocket(id: string): MockSocket {
  let listener: ((payload: unknown) => void) | undefined;
  return {
    id,
    on: jest.fn((_event, handler) => {
      listener = handler;
    }),
    off: jest.fn(() => {
      listener = undefined;
    }),
    emit: jest.fn((_event, payload) =>
      sockets[payload.target]?.receive({ callerId: id, signal: payload.signal })
    ),
    receive: (payload: unknown) => listener?.(payload),
  };
}
let a: RoomMedia;
let b: RoomMedia;
let updates: RemoteMedia[];
let errors: jest.Mock;
const setup = () => {
  sockets = { a: makeSocket("a"), b: makeSocket("b") };
  errors = jest.fn();
  a = new RoomMedia(sockets.a as MediaSocket, "room1", jest.fn(), errors);
  b = new RoomMedia(
    sockets.b as MediaSocket,
    "room1",
    (media) => {
      updates = media;
    },
    errors
  );
  a.setPlayers(["a", "b"]);
  b.setPlayers(["a", "b"]);
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (SimplePeer as unknown as jest.Mock).mockImplementation(createMockPeer);
  updates = [];
  setup();
});
afterEach(() => {
  a.dispose();
  b.dispose();
  jest.clearAllTimers();
  jest.useRealTimers();
});

test("a viewer with no local devices answers and receives the publisher's stream", () => {
  const camera = stream();
  a.setStream(camera);
  const sender = peers()[0];
  sender.fire("signal", { type: "offer", sdp: "offer" });
  const receiver = peers()[1];
  expect(receiver.options.initiator).toBe(false);
  expect(receiver.options.stream).toBeUndefined();
  receiver.fire("signal", { type: "answer", sdp: "answer" });
  expect(sender.signal).toHaveBeenCalledWith({ type: "answer", sdp: "answer" });
  receiver.fire("stream", camera);
  expect(updates).toEqual([
    {
      playerId: "a",
      video: true,
      audio: false,
      status: "connected",
      stream: camera,
    },
  ]);
});

test("a viewer mounting after an offer was lost requests a fresh offer", () => {
  b.dispose();
  a.setStream(stream());
  peers()[0].fire("signal", { type: "offer", sdp: "lost" });
  b = new RoomMedia(
    sockets.b as MediaSocket,
    "room1",
    (media) => {
      updates = media;
    },
    errors
  );
  b.setPlayers(["a", "b"]);
  expect(peers()[0].destroyed).toBe(true);
  const fresh = peers()[1];
  fresh.fire("signal", { type: "offer", sdp: "fresh" });
  expect(peers()[2].signal).toHaveBeenCalledWith({
    type: "offer",
    sdp: "fresh",
  });
});

test("simultaneous publishers have independent connections; stopping one keeps the other", () => {
  a.setStream(stream());
  b.setStream(stream(false, true));
  peers()[0].fire("signal", { type: "offer", sdp: "a" });
  peers()[1].fire("signal", { type: "offer", sdp: "b" });
  expect(peers()).toHaveLength(4);
  a.setStream(null);
  expect(peers()[0].destroyed).toBe(true);
  expect(peers()[2].destroyed).toBe(true);
  expect(peers()[1].destroyed).toBe(false);
  expect(peers()[3].destroyed).toBe(false);
  expect(updates).toEqual([]);
});

test("restarting ignores stale answers, candidates, stops, and destroyed-peer callbacks", () => {
  a.setStream(stream());
  const old = peers()[0];
  old.fire("signal", { type: "offer", sdp: "old" });
  const oldMessage = sockets.a.emit.mock.calls.find(
    (call) => call[1].signal.type === "signal"
  )?.[1].signal;
  a.setStream(stream());
  const fresh = peers()[2];
  fresh.fire("signal", { type: "offer", sdp: "fresh" });
  const receiver = peers()[3];
  sockets.a.receive({
    callerId: "b",
    signal: { ...oldMessage, data: { type: "answer", sdp: "late" } },
  });
  sockets.b.receive({ callerId: "a", signal: { ...oldMessage, type: "stop" } });
  old.fire("signal", { candidate: {} });
  expect(fresh.signal).not.toHaveBeenCalled();
  expect(receiver.destroyed).toBe(false);
});

test("unchanged rosters preserve connections; departing players clean them up", () => {
  a.setStream(stream());
  peers()[0].fire("signal", { type: "offer", sdp: "a" });
  a.setPlayers(["a", "b"]);
  b.setPlayers(["a", "b"]);
  expect(peers()).toHaveLength(2);
  b.setPlayers(["b"]);
  expect(peers()[1].destroyed).toBe(true);
  expect(updates).toEqual([]);
});

test("wrong-room and non-member signals cannot create peers", () => {
  const signal = {
    protocol: "guess-media-v1",
    roomName: "room1",
    type: "signal",
    sessionId: "x",
    publisherId: "c",
    data: { type: "offer" },
  };
  sockets.b.receive({ callerId: "c", signal });
  sockets.b.receive({
    callerId: "a",
    signal: { ...signal, roomName: "other", publisherId: "a" },
  });
  expect(peers()).toHaveLength(0);
});

test("stalled connections become actionable failures and can reconnect", () => {
  a.setStream(stream());
  peers()[0].fire("signal", { type: "offer", sdp: "a" });
  jest.advanceTimersByTime(15000);
  expect(updates[0].status).toBe("failed");
  expect(errors).toHaveBeenCalled();
  b.reconnect();
  const sender = peers()[2];
  sender.fire("signal", { type: "offer", sdp: "retry" });
  expect(updates[0].status).toBe("connecting");
});

test("disposing unregisters signals and destroys all connections and timers", () => {
  a.setStream(stream());
  peers()[0].fire("signal", { type: "offer", sdp: "a" });
  a.dispose();
  b.dispose();
  expect(sockets.a.off).toHaveBeenCalled();
  expect(peers().every((peer) => peer.destroyed)).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
