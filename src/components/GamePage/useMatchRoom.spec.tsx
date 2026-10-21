import { act, renderHook } from "@testing-library/react";
import { socket } from "../../services/socket";
import { RoomState } from "./matchTypes";
import { useMatchRoom } from "./useMatchRoom";

jest.mock("../../services/socket", () => {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const client = {
    id: "connection-1",
    connected: false,
    on: (event: string, handler: (...args: unknown[]) => void) =>
      listeners.set(event, handler),
    off: (event: string) => listeners.delete(event),
    timeout: () => client,
    emit: jest.fn(),
    connect: () => {
      client.connected = true;
      listeners.get("connect")?.();
    },
    disconnect: () => {
      client.connected = false;
      listeners.get("disconnect")?.();
    },
    notify: (event: string, value?: unknown) => listeners.get(event)?.(value),
  };
  return { socket: client };
});
const client = socket as unknown as {
  id: string;
  connected: boolean;
  emit: jest.Mock;
  connect: () => void;
  disconnect: () => void;
  notify: (event: string, value?: unknown) => void;
};
const snapshot = () =>
  ({
    roomName: "testroom",
    players: ["connection-1", "other"],
    lobbyId: "lobby-1",
    matchId: "match-1",
    turnId: 0,
    timeLeft: 30,
  } as RoomState);
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  client.connected = false;
  client.id = "connection-1";
});

test("direct URL joins using saved display name; unmount disconnects and removes listeners", () => {
  localStorage.setItem("guessTheWordPlayerName", "Alex");
  const { result, unmount } = renderHook(() => useMatchRoom("testroom"));
  expect(client.emit).toHaveBeenCalledWith(
    "joinRoom",
    { roomName: "testroom", nickname: "Alex" },
    expect.any(Function)
  );
  act(() => client.notify("roomUpdate", snapshot()));
  expect(result.current.room?.roomName).toBe("testroom");
  unmount();
  expect(client.connected).toBe(false);
});

test("timer updates preserve roster reference, so video setup is not restarted", () => {
  const { result } = renderHook(() => useMatchRoom("testroom"));
  act(() => client.notify("roomUpdate", snapshot()));
  const roster = result.current.room?.players;
  act(() => client.notify("roomUpdate", { ...snapshot(), timeLeft: 29 }));
  expect(result.current.room?.timeLeft).toBe(29);
  expect(result.current.room?.players).toBe(roster);
  act(() =>
    client.notify("roomUpdate", {
      ...snapshot(),
      players: ["connection-1", "other", "third"],
    })
  );
  expect(result.current.room?.players).not.toBe(roster);
});

test("rapid duplicate clicks are suppressed and requests identify the exact match and turn", () => {
  const { result } = renderHook(() => useMatchRoom("testroom"));
  act(() => client.notify("roomUpdate", snapshot()));
  act(() => {
    result.current.send("correctWord");
    result.current.send("correctWord");
  });
  const requests = client.emit.mock.calls.filter(
    ([event]) => event === "correctWord"
  );
  expect(requests).toHaveLength(1);
  expect(requests[0][1]).toMatchObject({
    roomName: "testroom",
    matchId: "match-1",
    turnId: 0,
    lobbyId: "lobby-1",
  });
  expect(result.current.pending).toBe(true);
  act(() =>
    requests[0][2](null, { ok: false, error: "That turn has already ended." })
  );
  expect(result.current.pending).toBe(false);
  expect(result.current.error).toBe("That turn has already ended.");
});

test("disconnect hides old state and reconnect joins as a fresh connection", () => {
  const { result } = renderHook(() => useMatchRoom("testroom"));
  act(() => client.notify("roomUpdate", snapshot()));
  act(() => client.disconnect());
  expect(result.current.room).toBeNull();
  expect(result.current.connection).toContain("Reconnecting as a new player");
  act(() => {
    client.id = "connection-2";
    client.connect();
  });
  expect(result.current.playerId).toBe("connection-2");
  expect(
    client.emit.mock.calls.filter(([event]) => event === "joinRoom")
  ).toHaveLength(2);
});
