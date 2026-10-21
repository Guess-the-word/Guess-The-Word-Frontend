import React, { useEffect, useRef, useState } from "react";
import { socket } from "../../services/socket";
import { VideoPlayer } from "./VideoPlayer";
import { RemoteMedia, RoomMedia } from "./roomMedia";
import { useLocalMedia } from "./useLocalMedia";
import "./VideoChat.css";

interface VideoChatProps {
  roomName: string;
  players: string[];
  describer?: string | null;
  nicknames?: Record<string, string>;
}

export const VideoChat: React.FC<VideoChatProps> = ({
  roomName,
  players,
  nicknames = {},
  describer = null,
}) => {
  const local = useLocalMedia();
  const [remote, setRemote] = useState<RemoteMedia[]>([]);
  const [connectionError, setConnectionError] = useState("");
  const [soundOn, setSoundOn] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
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

  useEffect(() => {
    if (expanded && !players.includes(expanded)) setExpanded(null);
  }, [players, expanded]);

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
          <h3>At the table</h3>
          <p>Good company. Great guesses.</p>
        </div>
        <span className="video-player-count">
          {players.length} player{players.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="video-controls">
        <button
          className={`video-toggle-button ${local.cameraOn ? "secondary" : ""}`}
          aria-label={
            local.busy.video
              ? "Waiting for camera…"
              : local.cameraOn
              ? "Turn camera off"
              : "Turn camera on"
          }
          aria-pressed={local.cameraOn}
          disabled={local.busy.video}
          onClick={() => local.toggle("video")}
        >
          {local.busy.video
            ? "Camera…"
            : local.cameraOn
            ? "Camera on"
            : "Camera off"}
        </button>
        <button
          className={`video-toggle-button ${local.micOn ? "secondary" : ""}`}
          aria-label={
            local.busy.audio
              ? "Waiting for microphone…"
              : local.micOn
              ? "Mute microphone"
              : "Turn microphone on"
          }
          aria-pressed={local.micOn}
          disabled={local.busy.audio}
          onClick={() => local.toggle("audio")}
        >
          {local.busy.audio ? "Mic…" : local.micOn ? "Mic on" : "Mic off"}
        </button>
        <button
          className="video-toggle-button secondary"
          aria-label={soundOn ? "Mute room sound" : "Turn room sound on"}
          aria-pressed={soundOn}
          onClick={() => setSoundOn((on) => !on)}
        >
          {soundOn ? "Sound on" : "Sound off"}
        </button>
      </div>
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
      <div className={`videoGrid ${expanded ? "has-expanded" : ""}`}>
        <div
          className={`videoSlot ${
            describer === socket.id ? "is-describing" : ""
          } ${expanded === socket.id ? "is-expanded" : ""}`}
        >
          {describer === socket.id && (
            <span className="describing-tag">Describing</span>
          )}
          <button
            className="video-expand"
            aria-label={
              expanded === socket.id
                ? "Shrink your video"
                : "Enlarge your video"
            }
            aria-expanded={expanded === socket.id}
            onClick={() =>
              setExpanded(expanded === socket.id ? null : socket.id || null)
            }
          >
            ⤢
          </button>
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
            <div
              className={`videoSlot ${
                describer === id ? "is-describing" : ""
              } ${expanded === id ? "is-expanded" : ""}`}
              key={id}
            >
              {describer === id && (
                <span className="describing-tag">Describing</span>
              )}
              <button
                className="video-expand"
                aria-label={`${expanded === id ? "Shrink" : "Enlarge"} ${name(
                  id
                )}’s video`}
                aria-expanded={expanded === id}
                onClick={() => setExpanded(expanded === id ? null : id)}
              >
                ⤢
              </button>
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
      <details className="video-settings">
        <summary>Audio &amp; video help</summary>
        <p className="video-help">
          Camera and mic start off. Turn Sound on to hear friends without
          sharing your microphone. Tap a video’s expand button for a closer
          look.
        </p>
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
      </details>
    </section>
  );
};
