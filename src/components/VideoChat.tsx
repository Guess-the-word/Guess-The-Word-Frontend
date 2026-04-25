import React, { useEffect, useRef } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import Peer from 'simple-peer';
import { Socket } from 'socket.io-client';
import './VideoChat.css';

interface VideoChatProps {
  socket: Socket;
  roomName: string;
  players: string[];
  nicknames: {
    [socketId: string]: string
  };
}

const VideoChat: React.FC<VideoChatProps> = ({ socket, roomName, players, nicknames }) => {
  const [streams, setStreams] = React.useState<{ [key: string]: MediaStream }>({});
  const [myStream, setMyStream] = React.useState<MediaStream | null>(null);
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({});

  // Get nickname for a socket ID
  const getNickname = (socketId: string) => {
    return nicknames[socketId] || socketId.substring(0, 6);
  };

  // Create a peer as initiator
  const createPeer = (target: string, stream: MediaStream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream
    });

    peer.on('signal', signal => {
      socket.emit('webrtc-signal', {
        roomName,
        to: target,
        signal
      });
    });

    peer.on('stream', remoteStream => {
      setStreams(prevStreams => ({
        ...prevStreams,
        [target]: remoteStream
      }));
    });

    return peer;
  };

  // Add a peer as receiver
  const addPeer = (caller: string, signal: any, stream: MediaStream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream
    });

    peer.on('signal', signal => {
      socket.emit('webrtc-signal', {
        roomName,
        to: caller,
        signal
      });
    });

    peer.on('stream', remoteStream => {
      setStreams(prevStreams => ({
        ...prevStreams,
        [caller]: remoteStream
      }));
    });

    peer.signal(signal);
    return peer;
  };

  useEffect(() => {
    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        setMyStream(stream);
        
        // Create peers for existing players
        players.forEach(playerId => {
          if (playerId !== socket.id && !peersRef.current[playerId]) {
            const peer = createPeer(playerId, stream);
            peersRef.current[playerId] = peer;
          }
        });

        // Listen for new signals
        socket.on('webrtc-signal', ({ from, signal }) => {
          if (from !== socket.id) {
            if (peersRef.current[from]) {
              peersRef.current[from].signal(signal);
            } else {
              const peer = addPeer(from, signal, stream);
              peersRef.current[from] = peer;
            }
          }
        });
      })
      .catch(err => {
        console.error('Error accessing media devices:', err);
      });

    return () => {
      // Clean up
      socket.off('webrtc-signal');
      const currentPeers = { ...peersRef.current };
      Object.values(currentPeers).forEach(peer => {
        peer.destroy();
      });
      if (myStream) {
        myStream.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [socket, roomName, players]);

  // Render video elements
  const renderVideos = () => {
    const allStreams = myStream ? { [socket.id as string]: myStream, ...streams } : streams;
    const streamEntries = Object.entries(allStreams);
    
    // If no streams, show placeholder
    if (streamEntries.length === 0) {
      return (
        <div className="video-placeholder">
          <p>Video chat will appear here when participants join</p>
        </div>
      );
    }

    // Create a 2x2 grid (or smaller if fewer streams)
    return (
      <Row>
        {streamEntries.map(([id, stream]) => (
          <Col key={id} xs={12} md={streamEntries.length === 1 ? 12 : 6} className="video-col">
            <div className="video-container">
              <video
                ref={node => {
                  if (node) node.srcObject = stream;
                }}
                autoPlay
                playsInline
                muted={id === socket.id} // Mute own audio
              />
              <div className="video-label">
                {id === socket.id ? 'You' : getNickname(id)}
              </div>
            </div>
          </Col>
        ))}
      </Row>
    );
  };

  return (
    <Card className="video-chat">
      <Card.Header>
        <h4>Video Chat</h4>
      </Card.Header>
      <Card.Body>
        {renderVideos()}
      </Card.Body>
    </Card>
  );
};

export default VideoChat;
