import React, { useEffect, useState, useRef, useMemo } from "react";
import SimplePeer, { SignalData } from "simple-peer";
import { socket } from "../../services/socket";
import { VideoPlayer } from "./VideoPlayer";
import "./VideoChat.css";

interface PeerObject {
  peerId: string; // the remote user's socket ID
  peer: SimplePeer.Instance; // the simple-peer instance
  stream: MediaStream | null; // the remote stream
}

interface VideoChatProps {
  roomName: string;
  players: string[];
}

export const VideoChat: React.FC<VideoChatProps> = ({ players }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerObject[]>([]);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const peersRef = useRef<PeerObject[]>([]);
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();

  const stablePlayers = useMemo(() => {
    return players.filter((id) => id !== socket.id).sort();
  }, [players]);

  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  useEffect(() => {
    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        console.log("Local stream started");

        setTimeout(() => {
          setIsStreamReady(true);
          console.log("Local stream marked as ready");
        }, 500);
      } catch (err) {
        console.error("Could not get user media", err);
      }
    }
    startStream();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!localStream || !isStreamReady) {
      console.log("Local stream not ready yet, skipping peer setup");
      return;
    }

    const delay = peers.length === 0 ? 1000 : 0;

    connectionTimeoutRef.current = setTimeout(() => {
      console.log("Setting up peers after delay. Players:", stablePlayers);
      console.log(
        "Current peers:",
        peersRef.current.map((p) => p.peerId)
      );

      const currentPeerIds = peersRef.current.map((p) => p.peerId);
      const newPlayerIds = stablePlayers;

      const arraysEqual =
        currentPeerIds.length === newPlayerIds.length &&
        currentPeerIds.every((id) => newPlayerIds.includes(id));

      if (arraysEqual) {
        console.log("Player list unchanged, skipping peer recreation");
        return;
      }

      const playersWhoLeft = currentPeerIds.filter(
        (id) => !newPlayerIds.includes(id)
      );

      if (playersWhoLeft.length > 0) {
        console.log("Players who left:", playersWhoLeft);
        playersWhoLeft.forEach((playerId) => {
          const peerObj = peersRef.current.find((p) => p.peerId === playerId);
          if (peerObj) {
            console.log(`Destroying peer for ${playerId}`);
            peerObj.peer.destroy();
            if (peerObj.stream) {
              peerObj.stream.getTracks().forEach((track) => track.stop());
            }
          }
        });

        setPeers((prev) => prev.filter((p) => newPlayerIds.includes(p.peerId)));
      }

      const playersWhoJoined = newPlayerIds.filter(
        (id) => !currentPeerIds.includes(id)
      );

      if (playersWhoJoined.length > 0) {
        console.log("Players who joined:", playersWhoJoined);
        const newPeers: PeerObject[] = [];

        playersWhoJoined.forEach((playerId) => {
          console.log(`Creating peer for new player ${playerId}`);

          const peer = new SimplePeer({
            initiator: (socket.id || "") < playerId,
            trickle: false,
            stream: localStream,
          });

          peer.on("signal", (signalData: SignalData) => {
            console.log(`Sending signal to ${playerId}`);
            socket.emit("webrtc-signal", {
              target: playerId,
              callerId: socket.id,
              signal: signalData,
            });
          });

          peer.on("stream", (remoteStream: MediaStream) => {
            console.log(`Received stream from ${playerId}`, remoteStream);
            setPeers((existing) =>
              existing.map((obj) => {
                if (obj.peerId === playerId) {
                  return { ...obj, stream: remoteStream };
                }
                return obj;
              })
            );
          });

          peer.on("track", (_track, remoteStream) => {
            console.log(`Received track from ${playerId}`, remoteStream);
            setPeers((existing) =>
              existing.map((obj) => {
                if (obj.peerId === playerId) {
                  return { ...obj, stream: remoteStream as MediaStream };
                }
                return obj;
              })
            );
          });

          peer.on("error", (err) => {
            console.error(`Peer error for ${playerId}:`, err);
          });

          peer.on("close", () => {
            console.log(`Peer connection closed for ${playerId}`);
            setPeers((prev) => prev.filter((p) => p.peerId !== playerId));
          });

          peer.on("connect", () => {
            console.log(`Peer connected to ${playerId}`);
          });

          newPeers.push({ peerId: playerId, peer, stream: null });
        });

        if (newPeers.length > 0) {
          setPeers((prev) => {
            const updated = [...prev, ...newPeers];
            console.log(
              "Updated peers:",
              updated.map((p) => p.peerId)
            );
            return updated;
          });
        }
      }
    }, delay);

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [stablePlayers, localStream, isStreamReady]);

  useEffect(() => {
    function handleSignal(payload: { callerId: string; signal: SignalData }) {
      const { callerId, signal } = payload;
      console.log(`Received signal from ${callerId}`);

      const peerObj = peersRef.current.find((p) => p.peerId === callerId);
      if (!peerObj) {
        console.log(`No peer found for signal from ${callerId}`);
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
      console.log("VideoChat component unmounting, cleaning up peers");
      peersRef.current.forEach((obj) => {
        obj.peer.destroy();
        if (obj.stream) {
          obj.stream.getTracks().forEach((track) => track.stop());
        }
      });
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [localStream]);

  const displayedPeers = peers.slice(0, 3);
  const totalVideos = 1 + displayedPeers.length;

  console.log(
    "Rendering VideoChat with peers:",
    displayedPeers.map((p) => ({ id: p.peerId, hasStream: !!p.stream }))
  );

  return (
    <div className="videoChatContainer">
      <div className={`videoGrid videoCount-${totalVideos}`}>
        <div className="videoSlot">
          <VideoPlayer stream={localStream} muted />
        </div>
        {displayedPeers.map((obj) => (
          <div className="videoSlot" key={obj.peerId}>
            <VideoPlayer stream={obj.stream} />
          </div>
        ))}
      </div>
    </div>
  );
};
