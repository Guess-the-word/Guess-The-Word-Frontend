import React, { useEffect, useState, useRef, useMemo } from "react";
import SimplePeer, { SignalData } from "simple-peer";
import { socket } from "../../services/socket";
import { VideoPlayer } from "./VideoPlayer";
import "./VideoChat.css";

/**
 * Minimal WebRTC chat with up to 4 peers in the same room.
 * Each peer is set up to connect to every other peer in `players` (except itself).
 */
interface PeerObject {
  peerId: string; // the remote user's socket ID
  peer: SimplePeer.Instance; // the simple-peer instance
  stream: MediaStream | null; // the remote stream
}

export const VideoChat: React.FC<{
  roomName: string;
  players: string[];
}> = ({ players }) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<PeerObject[]>([]);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const peersRef = useRef<PeerObject[]>([]);
  const connectionTimeoutRef = useRef<NodeJS.Timeout>();

  // Memoize the players list to avoid unnecessary re-renders
  const stablePlayers = useMemo(() => {
    return players.filter((id) => id !== socket.id).sort();
  }, [players]);

  // Update ref whenever peers state changes
  useEffect(() => {
    peersRef.current = peers;
  }, [peers]);

  // 1. Get local video/audio
  useEffect(() => {
    async function startStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);
        console.log("Local stream started");

        // Give a small delay to ensure the stream is fully ready
        setTimeout(() => {
          setIsStreamReady(true);
          console.log("Local stream marked as ready");
        }, 500);
      } catch (err) {
        console.error("Could not get user media", err);
      }
    }
    startStream();

    // Cleanup function to stop local stream when component unmounts
    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, []);

  // 2. Handle player changes (joining/leaving) - but only after stream is ready
  useEffect(() => {
    if (!localStream || !isStreamReady) {
      console.log("Local stream not ready yet, skipping peer setup");
      return;
    }

    // Add a small delay for initial connections to ensure both sides are ready
    const delay = peers.length === 0 ? 1000 : 0;

    connectionTimeoutRef.current = setTimeout(() => {
      console.log("Setting up peers after delay. Players:", stablePlayers);
      console.log(
        "Current peers:",
        peersRef.current.map((p) => p.peerId)
      );

      const currentPeerIds = peersRef.current.map((p) => p.peerId);
      const newPlayerIds = stablePlayers;

      // Check if anything actually changed
      const arraysEqual =
        currentPeerIds.length === newPlayerIds.length &&
        currentPeerIds.every((id) => newPlayerIds.includes(id));

      if (arraysEqual) {
        console.log("Player list unchanged, skipping peer recreation");
        return;
      }

      // Remove peers for players who left
      const playersWhoLeft = currentPeerIds.filter(
        (id) => !newPlayerIds.includes(id)
      );

      if (playersWhoLeft.length > 0) {
        console.log("Players who left:", playersWhoLeft);
        playersWhoLeft.forEach((playerId) => {
          const peerObj = peersRef.current.find((p) => p.peerId === playerId);
          if (peerObj) {
            console.log(`Destroying peer for ${playerId}`);
            // Close the peer connection
            peerObj.peer.destroy();
            // Stop the stream if it exists
            if (peerObj.stream) {
              peerObj.stream.getTracks().forEach((track) => track.stop());
            }
          }
        });

        // Update peers state to remove left players
        setPeers((prev) => prev.filter((p) => newPlayerIds.includes(p.peerId)));
      }

      // Add peers for new players
      const playersWhoJoined = newPlayerIds.filter(
        (id) => !currentPeerIds.includes(id)
      );

      if (playersWhoJoined.length > 0) {
        console.log("Players who joined:", playersWhoJoined);
        const newPeers: PeerObject[] = [];

        playersWhoJoined.forEach((playerId) => {
          console.log(`Creating peer for new player ${playerId}`);

          const peer = new SimplePeer({
            initiator: (socket.id || "") < playerId, // to avoid collision, let's pick whichever ID is 'less' to be initiator
            trickle: false,
            stream: localStream,
          });

          peer.on("signal", (signalData: SignalData) => {
            console.log(`Sending signal to ${playerId}`);
            // We produce an offer/answer/candidate -> forward it via socket
            socket.emit("webrtc-signal", {
              target: playerId,
              callerId: socket.id,
              signal: signalData,
            });
          });

          peer.on("stream", (remoteStream: MediaStream) => {
            console.log(`Received stream from ${playerId}`, remoteStream);
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

          // Some browsers emit individual tracks instead of full stream
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
            // Remove this peer from state when connection closes
            setPeers((prev) => prev.filter((p) => p.peerId !== playerId));
          });

          peer.on("connect", () => {
            console.log(`Peer connected to ${playerId}`);
          });

          // Add to local state
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
  }, [stablePlayers, localStream, isStreamReady]); // Add isStreamReady dependency

  // 3. Listen for incoming signals from other peers
  useEffect(() => {
    function handleSignal(payload: { callerId: string; signal: SignalData }) {
      const { callerId, signal } = payload;
      console.log(`Received signal from ${callerId}`);
      // find the peer object using the current ref
      const peerObj = peersRef.current.find((p) => p.peerId === callerId);
      if (!peerObj) {
        console.log(`No peer found for signal from ${callerId}`);
        return;
      }

      try {
        // Let simple-peer handle the incoming signal
        peerObj.peer.signal(signal);
      } catch (err) {
        console.error(`Error handling signal from ${callerId}:`, err);
      }
    }

    socket.on("webrtc-signal", handleSignal);
    return () => {
      socket.off("webrtc-signal", handleSignal);
    };
  }, []); // No dependencies needed since we use ref

  // 4. Cleanup on unmount
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

  // 5. Render a 2×2 grid for local + remote streams
  // For a maximum of 4 participants. If you have more, you'll need a dynamic layout.
  // players array might have more than 4, but we'll just show up to 4 for demonstration.
  const displayedPeers = peers.slice(0, 3); // up to 3 remote
  const totalVideos = 1 + displayedPeers.length; // local + remote

  console.log(
    "Rendering VideoChat with peers:",
    displayedPeers.map((p) => ({ id: p.peerId, hasStream: !!p.stream }))
  );

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
