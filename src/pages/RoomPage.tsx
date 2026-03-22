import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import GamePage from './GamePage';
import PlayersList from '../components/PlayersList';
import TeamsDisplay from '../components/TeamsDisplay';
import GuessConsole from '../components/GuessConsole';
import VideoChat from '../components/VideoChat';
import { Container, Row, Col, Alert } from 'react-bootstrap';
import './RoomPage.css';

// Define types for the game state
interface GameState {
  roomName: string;
  players: string[];
  teams: {
    [teamId: string]: string[]
  };
  score: {
    [teamId: string]: number
  };
  status: "waiting" | "playing";
  currentTeam: string;
  describer: string;
  isDescriber: boolean;
  word: string;
  timeLeft: number;
  nicknames: {
    [socketId: string]: string
  };
  guessConsole: {
    player: string;
    guess: string;
    correct: boolean;
    timestamp: number;
  }[];
}

// Initial game state
const initialGameState: GameState = {
  roomName: '',
  players: [],
  teams: { '1': [], '2': [] },
  score: { '1': 0, '2': 0 },
  status: 'waiting',
  currentTeam: '1',
  describer: '',
  isDescriber: false,
  word: '',
  timeLeft: 60,
  nicknames: {},
  guessConsole: []
};

const RoomPage: React.FC = () => {
  const { roomName } = useParams<{ roomName: string }>();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    ...initialGameState,
    roomName: roomName || ''
  });
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  // Connect to Socket.IO server
  useEffect(() => {
    // Connect to the server
    const newSocket = io('http://localhost:4000');
    setSocket(newSocket);

    // Handle connection errors
    newSocket.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`);
    });

    // Clean up on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Join room when socket is ready
  useEffect(() => {
    if (socket && roomName) {
      // Join the room
      socket.emit('joinRoom', { roomName });

      // Set up event listeners
      socket.on('roomUpdate', (roomData) => {
        setGameState(prevState => ({
          ...prevState,
          ...roomData,
          roomName,
          isDescriber: roomData.describer === socket.id,
        }));
      });

      socket.on('gameStarted', ({ currentTeam, describer, timeLeft }) => {
        setGameState(prevState => ({
          ...prevState,
          status: 'playing',
          currentTeam,
          describer,
          timeLeft,
          isDescriber: describer === socket.id,
        }));
      });

      socket.on('yourWord', ({ word }) => {
        setGameState(prevState => ({
          ...prevState,
          word
        }));
      });

      socket.on('guessResult', ({ player, guess, correct }) => {
        setGameState(prevState => ({
          ...prevState,
          guessConsole: [
            ...prevState.guessConsole,
            { player, guess, correct, timestamp: Date.now() }
          ]
        }));
      });

      socket.on('timerUpdate', ({ timeLeft }) => {
        setGameState(prevState => ({
          ...prevState,
          timeLeft
        }));
      });

      socket.on('timeUp', () => {
        // Handle time up event if needed
      });

      socket.on('nextTurn', ({ currentTeam, describer, timeLeft }) => {
        setGameState(prevState => ({
          ...prevState,
          currentTeam,
          describer,
          timeLeft,
          isDescriber: describer === socket.id,
        }));
      });

      // Clean up event listeners on unmount
      return () => {
        socket.off('roomUpdate');
        socket.off('gameStarted');
        socket.off('yourWord');
        socket.off('guessResult');
        socket.off('timerUpdate');
        socket.off('timeUp');
        socket.off('nextTurn');
      };
    }
  }, [socket, roomName]);

  // Handle start game
  const handleStartGame = () => {
    if (socket) {
      socket.emit('startGame', { roomName });
    }
  };

  // Handle reset game
  const handleResetGame = () => {
    if (socket) {
      socket.emit('resetGame', { roomName });
    }
  };

  // Handle guess submission
  const handleGuessSubmit = (guess: string) => {
    if (socket) {
      socket.emit('guessWord', { roomName, guess });
    }
  };

  // Toggle video chat
  const toggleVideoChat = () => {
    setShowVideo(!showVideo);
  };

  if (!socket) {
    return <div className="loading">Connecting to server...</div>;
  }

  return (
    <Container fluid className="room-container">
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      <Row>
        <Col md={8}>
          <GamePage
            socket={socket}
            gameState={gameState}
            onStartGame={handleStartGame}
            onResetGame={handleResetGame}
            onGuessSubmit={handleGuessSubmit}
          />
        </Col>

        <Col md={4}>
          <div className="sidebar">
            <PlayersList
              players={gameState.players}
              nicknames={gameState.nicknames}
              describer={gameState.describer}
            />

            <TeamsDisplay
              teams={gameState.teams}
              score={gameState.score}
              nicknames={gameState.nicknames}
              describer={gameState.describer}
              currentTeam={gameState.currentTeam}
            />

            <GuessConsole
              guessConsole={gameState.guessConsole}
              nicknames={gameState.nicknames}
            />

            <div className="video-toggle">
              <button 
                className={`btn ${showVideo ? 'btn-danger' : 'btn-success'}`}
                onClick={toggleVideoChat}
              >
                {showVideo ? 'Hide Video Chat' : 'Show Video Chat'}
              </button>
            </div>

            {showVideo && (
              <VideoChat
                socket={socket}
                roomName={gameState.roomName}
                players={gameState.players}
                nicknames={gameState.nicknames}
              />
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default RoomPage;
