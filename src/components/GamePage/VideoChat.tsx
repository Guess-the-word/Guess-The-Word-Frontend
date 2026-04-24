import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SimplePeer, { SignalData } from "simple-peer";
import { socket } from "../../services/socket";
import { VideoPlayer } from "./VideoPlayer";
import "./VideoChat.css";

interface PeerObject {
  peerId: string;
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
}

interface VideoChatProps {
  roomName: string;
  players: string[];
  nicknames?: Record<string, string>;
}

export const VideoChat: React.FC<VideoChatProps> = ({
  players,
  nicknames = {},
}) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerObject[]>([]);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [streamError, setStreamError] = useState("");
  const peersRef = useRef<PeerObject[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();

  const stablePlayers = useMemo(() => {
    return players.filter((id) => id !== socket.id).sort();
  }, [players]);

  const getName = useCallback(
    (id: string): string => nicknames[id] || "Friend",
    [nicknames]
  );

  const stopPeers = useCallback(() => {
    peersRef.current.forEach((obj) => {
      obj.peer.destroy();
      if (obj.stream) {
        obj.stream.getTracks().forEach((track) => track.stop());
      }
    });
    peersRef.current = [];
    setPeers([]);
  }, []);

  const stopStream = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);
    setIsStreamReady(false);
    setIsVideoEnabled(false);
    stopPeers();
  }, [stopPeers]);

  const startStream = async (): Promise<void> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStreamError("Video is not available in this browser.");
      return;
    }

    try {
      setStreamError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsVideoEnabled(true);
      window.setTimeout(() => setIsStreamReady(true), 400);
    } catch (err) {
      console.error("Could not get user media", err);
      setStreamError("Camera or microphone permission was blocked.");
      setIsVideoEnabled(false);
      setIsStreamReady(false);
    }
  };

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!localStream || !isStreamReady || !isVideoEnabled) {
      return;
    }

    const delay = peers.length === 0 ? 1000 : 0;

    connectionTimeoutRef.current = setTimeout(() => {
      const currentPeerIds = peersRef.current.map((p) => p.peerId);
      const newPlayerIds = stablePlayers;
      const arraysEqual =
        currentPeerIds.length === newPlayerIds.length &&
        currentPeerIds.every((id) => newPlayerIds.includes(id));

      if (arraysEqual) {
        return;
      }

      const playersWhoLeft = currentPeerIds.filter(
        (id) => !newPlayerIds.includes(id)
      );

      playersWhoLeft.forEach((playerId) => {
        const peerObj = peersRef.current.find((p) => p.peerId === playerId);
        if (peerObj) {
          peerObj.peer.destroy();
          if (peerObj.stream) {
            peerObj.stream.getTracks().forEach((track) => track.stop());
          }
        }
      });

      if (playersWhoLeft.length > 0) {
        setPeers((prev) => prev.filter((p) => newPlayerIds.includes(p.peerId)));
      }

      const playersWhoJoined = newPlayerIds.filter(
        (id) => !currentPeerIds.includes(id)
      );

      if (playersWhoJoined.length > 0) {
        const newPeers: PeerObject[] = [];

        playersWhoJoined.forEach((playerId) => {
          const peer = new SimplePeer({
            initiator: (socket.id || "") < playerId,
            trickle: false,
            stream: localStream,
          });

          peer.on("signal", (signalData: SignalData) => {
            socket.emit("webrtc-signal", {
              target: playerId,
              callerId: socket.id,
              signal: signalData,
            });
          });

          peer.on("stream", (remoteStream: MediaStream) => {
            setPeers((existing) =>
              existing.map((obj) =>
                obj.peerId === playerId ? { ...obj, stream: remoteStream } : obj
              )
            );
          });

          peer.on("track", (_track, remoteStream) => {
            setPeers((existing) =>
              existing.map((obj) =>
                obj.peerId === playerId
                  ? { ...obj, stream: remoteStream as MediaStream }
                  : obj
              )
            );
          });

          peer.on("error", (err) => {
            console.error(`Peer error for ${playerId}:`, err);
          });

          peer.on("close", () => {
            setPeers((prev) => prev.filter((p) => p.peerId !== playerId));
          });

          newPeers.push({ peerId: playerId, peer, stream: null });
        });

        if (newPeers.length > 0) {
          setPeers((prev) => [...prev, ...newPeers]);
        }
      }
    }, delay);

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [stablePlayers, localStream, isStreamReady, isVideoEnabled, peers.length]);

  useEffect(() => {
    function handleSignal(payload: { callerId: string; signal: SignalData }) {
      const { callerId, signal } = payload;
      const peerObj = peersRef.current.find((p) => p.peerId === callerId);

      if (!peerObj) {
        return;
      }

      try {
        peerObj.peer.signal(signal);
      } catch (err) {
        console.error(`Error handling signal from ${callerId}:`, err);
      }
    }

    socket.on("webrtc-signal", handleSignal);
    return () => {
      socket.off("webrtc-signal", handleSignal);
    };
  }, []);

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  const displayedPeers = peers.slice(0, 3);
  const hiddenPeerCount = Math.max(0, peers.length - displayedPeers.length);
  const totalVideos = 1 + displayedPeers.length;

  if (!isVideoEnabled) {
    return (
      <div className="videoChatContainer videoChatContainerIdle">
        <div className="video-empty-state">
          <div>
            <h3>Video Room</h3>
            <p>
              {players.length} player{players.length === 1 ? "" : "s"} in room
            </p>
          </div>
          <button className="video-toggle-button" onClick={startStream}>
            Start Video
          </button>
        </div>
        {streamError && <div className="video-error">{streamError}</div>}
      </div>
    );
  }

  return (
    <div className="videoChatContainer">
      <div className="video-toolbar">
        <div>
          <h3>Video Room</h3>
          <p>
            {players.length} player{players.length === 1 ? "" : "s"} in room
          </p>
        </div>
        <button className="video-toggle-button secondary" onClick={stopStream}>
          Turn Off
        </button>
      </div>

      <div className={`videoGrid videoCount-${Math.min(totalVideos, 4)}`}>
        <div className="videoSlot">
          <VideoPlayer stream={localStream} muted />
          <span className="player-name">You</span>
        </div>
        {displayedPeers.map((obj) => (
          <div className="videoSlot" key={obj.peerId}>
            <VideoPlayer stream={obj.stream} />
            {!obj.stream && (
              <span className="connecting-label">Connecting</span>
            )}
            <span className="player-name">{getName(obj.peerId)}</span>
          </div>
        ))}
      </div>

      {hiddenPeerCount > 0 && (
        <div className="video-overflow">{hiddenPeerCount} more off camera</div>
      )}
    </div>
  );
};
