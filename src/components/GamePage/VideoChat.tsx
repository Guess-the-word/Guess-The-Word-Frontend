import React, { useEffect, useRef, useState } from "react";
import { socket } from "../../services/socket";
import { VideoPlayer } from "./VideoPlayer";
import { RemoteMedia, RoomMedia } from "./roomMedia";
import { useLocalMedia } from "./useLocalMedia";
import "./VideoChat.css";

interface VideoChatProps {
  roomName: string;
  players: string[];
  nicknames?: Record<string, string>;
}

export const VideoChat: React.FC<VideoChatProps> = ({
  roomName,
  players,
  nicknames = {},
}) => {
  const local = useLocalMedia();
  const [remote, setRemote] = useState<RemoteMedia[]>([]);
  const [connectionError, setConnectionError] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const media = useRef<RoomMedia | null>(null);

  useEffect(() => {
    const controller = new RoomMedia(
      socket,
      roomName,
      setRemote,
      setConnectionError
    );
    media.current = controller;
    return () => {
      controller.dispose();
      media.current = null;
    };
  }, [roomName]);
  useEffect(() => {
    media.current?.setPlayers(players);
  }, [players, roomName]);
  useEffect(() => {
    media.current?.setStream(local.stream);
  }, [local.stream, roomName]);

  const others = players.filter((id) => id !== socket.id);
  const name = (id: string) => {
    const base = nicknames[id] || "Friend";
    const duplicates = players.filter((player) => nicknames[player] === base);
    return duplicates.length > 1
      ? `${base} · ${duplicates.indexOf(id) + 1}`
      : base;
  };
  const errors = [
    local.errors.video,
    local.errors.audio,
    connectionError,
  ].filter(Boolean);

  return (
    <section className="videoChatContainer" aria-label="Video room">
      <div className="video-toolbar">
        <div>
          <h3>Video room</h3>
          <p>See your friends, even with your camera off.</p>
        </div>
        <span className="video-player-count">
          {players.length} player{players.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="video-controls">
        <button
          className={`video-toggle-button ${local.cameraOn ? "secondary" : ""}`}
          aria-pressed={local.cameraOn}
          disabled={local.busy.video}
          onClick={() => local.toggle("video")}
        >
          {local.busy.video
            ? "Waiting for camera…"
            : local.cameraOn
            ? "Turn camera off"
            : "Turn camera on"}
        </button>
        <button
          className={`video-toggle-button ${local.micOn ? "secondary" : ""}`}
          aria-pressed={local.micOn}
          disabled={local.busy.audio}
          onClick={() => local.toggle("audio")}
        >
          {local.busy.audio
            ? "Waiting for microphone…"
            : local.micOn
            ? "Mute microphone"
            : "Turn microphone on"}
        </button>
        <button
          className="video-toggle-button secondary"
          aria-pressed={soundOn}
          onClick={() => setSoundOn((on) => !on)}
        >
          {soundOn ? "Mute room sound" : "Turn room sound on"}
        </button>
      </div>
      <p className="video-help">
        Your camera and mic start off. Room sound lets you hear others without
        sharing your microphone.
      </p>
      {(local.busy.video || local.busy.audio) && (
        <div className="video-permission" role="status">
          Allow access in the browser permission prompt.
          {local.busy.video && (
            <button onClick={() => local.cancel("video")}>
              Cancel camera request
            </button>
          )}
          {local.busy.audio && (
            <button onClick={() => local.cancel("audio")}>
              Cancel microphone request
            </button>
          )}
        </div>
      )}
      {(local.paused.video || local.paused.audio) && (
        <div className="video-permission" role="status">
          <span>
            The browser paused your{" "}
            {local.paused.video ? "camera" : "microphone"}. Another tab may be
            using it. Turn it off in that tab, then resume here.
          </span>
          {local.paused.video && (
            <button
              disabled={local.busy.video}
              onClick={() => local.resume("video")}
            >
              Resume camera
            </button>
          )}
          {local.paused.audio && (
            <button
              disabled={local.busy.audio}
              onClick={() => local.resume("audio")}
            >
              Resume microphone
            </button>
          )}
        </div>
      )}
      {errors.map((error) => (
        <div className="video-error" role="alert" key={error}>
          {error}
        </div>
      ))}
      <div className="videoGrid">
        <div className="videoSlot">
          <VideoPlayer stream={local.stream} muted label="Your camera" />
          {(!local.cameraOn || local.paused.video) && (
            <div className="video-placeholder">
              <span>You</span>
              <small>
                {local.paused.video ? "Camera paused by browser" : "Camera off"}
              </small>
            </div>
          )}
          <span className="player-name">
            You ·{" "}
            {local.paused.audio
              ? "Mic paused"
              : local.micOn
              ? "Mic on"
              : "Mic off"}
          </span>
        </div>
        {others.map((id) => {
          const participant = remote.find((item) => item.playerId === id);
          const connected = participant?.status === "connected";
          const status =
            participant?.status === "failed"
              ? "Connection failed · try Reconnect video"
              : participant?.status === "connecting"
              ? "Connecting…"
              : participant?.videoPaused
              ? "Camera paused by their browser"
              : participant?.video
              ? ""
              : "Camera off";
          return (
            <div className="videoSlot" key={id}>
              <VideoPlayer
                stream={participant?.stream || null}
                muted={!soundOn}
                label={`${name(id)}'s video`}
              />
              {(!connected ||
                !participant?.video ||
                participant.videoPaused) && (
                <div className="video-placeholder">
                  <span>{name(id)}</span>
                  <small>{status}</small>
                </div>
              )}
              <span className="player-name">
                {name(id)} ·{" "}
                {participant?.audioPaused
                  ? "Mic paused"
                  : participant?.audio
                  ? "Mic on"
                  : "Mic off"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="video-footer">
        <span>
          {others.length
            ? "Everyone in this room can see and hear what you share."
            : "Invite a friend to see their video here."}
        </span>
        {others.length > 0 && (
          <button
            className="video-reconnect"
            onClick={() => {
              setConnectionError("");
              media.current?.reconnect();
            }}
          >
            Reconnect video
          </button>
        )}
      </div>
    </section>
  );
};
