import { useEffect, useRef, useState } from "react";
import { socket } from "../../services/socket";
import { ActionResult, RoomState } from "./matchTypes";

export function useMatchRoom(roomName: string) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [connection, setConnection] = useState("Connecting to the room…");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const pendingId = useRef<string | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    let active = true;
    setRoom(null);
    setError("");
    pendingId.current = null;
    setPending(false);
    const join = () => {
      setPlayerId(socket.id || "");
      setError("");
      setConnection("Joining the room…");
      socket.timeout(5000).emit(
        "joinRoom",
        {
          roomName,
          nickname: localStorage.getItem("guessTheWordPlayerName") || "",
        },
        (timeout: Error | null, result?: ActionResult) => {
          if (!active) return;
          if (timeout || !result?.ok)
            setError(
              result?.error ||
                "Could not join. Check your connection and try again."
            );
        }
      );
    };
    const receive = (state: RoomState) => {
      if (state.roomName !== roomName) return;
      // Timer snapshots must not restart video-peer setup for an unchanged roster.
      setRoom((previous) => ({
        ...state,
        players:
          previous &&
          previous.players.length === state.players.length &&
          previous.players.every((id, index) => id === state.players[index])
            ? previous.players
            : state.players,
      }));
      setConnection("");
    };
    const disconnected = () => {
      setRoom(null);
      pendingId.current = null;
      setPending(false);
      setConnection("Connection lost. Reconnecting as a new player…");
    };
    const failed = () =>
      setConnection("Cannot reach the game server. Retrying…");
    socket.on("connect", join);
    socket.on("roomUpdate", receive);
    socket.on("disconnect", disconnected);
    socket.on("connect_error", failed);
    if (socket.connected) join();
    else socket.connect();
    return () => {
      active = false;
      pendingId.current = null;
      socket.off("connect", join);
      socket.off("roomUpdate", receive);
      socket.off("disconnect", disconnected);
      socket.off("connect_error", failed);
      socket.disconnect();
    };
  }, [roomName]);

  const send = (event: string, values: Record<string, unknown> = {}) => {
    if (!room || !socket.connected || pendingId.current) return;
    const actionId = `${socket.id}:${++counter.current}`;
    pendingId.current = actionId;
    setPending(true);
    setError("");
    socket.timeout(5000).emit(
      event,
      {
        roomName,
        lobbyId: room.lobbyId,
        matchId: room.matchId,
        turnId: room.turnId,
        actionId,
        ...values,
      },
      (timeout: Error | null, result?: ActionResult) => {
        if (pendingId.current !== actionId) return;
        pendingId.current = null;
        setPending(false);
        if (timeout || !result?.ok)
          setError(
            result?.error ||
              "No confirmation received. Check the current state before trying again."
          );
      }
    );
  };
  return { room, playerId, connection, error, pending, send };
}
