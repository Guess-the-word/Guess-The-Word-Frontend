import React, { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client"; // you already have socket
import SimplePeer, { SignalData } from "simple-peer";
import { socket } from "../../services/socket";
import { VideoPlayer } from "./VideoPlayer";
import "./VideoChat.css";

/**
 * Minimal WebRTC chat with up to 4 peers in the same room.
 * Each peer is set up to connect to every other peer in `players` (except itself).
 */
interface PeerObject {
  peerId: string; // the remote user’s socket ID
  peer: SimplePeer.Instance; // the simple-peer instance
  stream: MediaStream | null; // the remote stream
}

export const VideoChat: React.FC<{
  roomName: string;
  players: string[];
}> = ({ players }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerObject[]>([]);

  // 1. Get local video/audio
  useEffect(() => {
    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
      } catch (err) {
        console.error("Could not get user media", err);
      }
    }
    startStream();
  }, []);

  // 2. Initialize or Update connections when players change
  useEffect(() => {
    if (!localStream) return;
    // For each known remote player (besides ourselves), check if we already have a peer.
    // If not, create a new SimplePeer instance and store it.
    const newPeers: PeerObject[] = [];

    players.forEach((playerId) => {
      if (playerId === socket.id) return; // skip self
      if (peers.find((p) => p.peerId === playerId)) return; // already have a peer

      const peer = new SimplePeer({
        initiator: (socket.id || "") < playerId, // to avoid collision, let's pick whichever ID is 'less' to be initiator
        trickle: false,
        stream: localStream,
      });

      peer.on("signal", (signalData: SignalData) => {
        // We produce an offer/answer/candidate -> forward it via socket
        socket.emit("webrtc-signal", {
          target: playerId,
          callerId: socket.id,
          signal: signalData,
        });
      });

      peer.on("stream", (remoteStream: any) => {
        // we got remote video
        setPeers((existing) =>
          existing.map((obj) => {
            if (obj.peerId === playerId) {
              return { ...obj, stream: remoteStream };
            }
            return obj;
          })
        );
      });

      // Add to local state
      newPeers.push({ peerId: playerId, peer, stream: null });
    });

    if (newPeers.length > 0) {
      setPeers((prev) => [...prev, ...newPeers]);
    }
  }, [players, localStream, peers]);

  // 3. Listen for incoming signals from other peers
  useEffect(() => {
    function handleSignal(payload: { callerId: string; signal: SignalData }) {
      const { callerId, signal } = payload;
      // find the peer object
      const peerObj = peers.find((p) => p.peerId === callerId);
      if (!peerObj) return; // we might not have them yet

      // Let simple-peer handle the incoming signal
      peerObj.peer.signal(signal);
    }

    socket.on("webrtc-signal", handleSignal);
    return () => {
      socket.off("webrtc-signal", handleSignal);
    };
  }, [peers]);

  // 4. Cleanup on unmount
  useEffect(() => {
    return () => {
      peers.forEach((obj) => {
        obj.peer.destroy();
      });
    };
  }, [peers]);

  // 5. Render a 2×2 grid for local + remote streams
  // For a maximum of 4 participants. If you have more, you’ll need a dynamic layout.
  // players array might have more than 4, but we’ll just show up to 4 for demonstration.
  const displayedPeers = peers.slice(0, 3); // up to 3 remote
  const totalVideos = 1 + displayedPeers.length; // local + remote

  return (
    <div className="videoChatContainer">
      <div className={`videoGrid videoCount-${totalVideos}`}>
        {/* Local video */}
        <div className="videoSlot">
          <VideoPlayer stream={localStream} muted />
        </div>
        {/* Remote videos */}
        {displayedPeers.map((obj) => (
          <div className="videoSlot" key={obj.peerId}>
            <VideoPlayer stream={obj.stream} />
          </div>
        ))}
      </div>
    </div>
  );
};
