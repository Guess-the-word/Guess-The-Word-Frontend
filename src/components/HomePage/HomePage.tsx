import React, { useState, useEffect } from "react";
import Container from "react-bootstrap/Container";
import { Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { socket } from "../../services/socket";
import "./HomePage.css";

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem("guessTheWordPlayerName") || ""
  );
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const handleRoomUpdate = ({ roomName }: { roomName: string }) => {
      setIsJoining(false);
      navigate(`/room/${roomName}`);
    };

    socket.on("roomUpdate", handleRoomUpdate);

    return () => {
      socket.off("roomUpdate", handleRoomUpdate);
    };
  }, [navigate]);

  const validateInput = (inputSize: number, value = roomName): boolean => {
    const alphanumericRegex = /^[0-9a-zA-Z]+$/;

    if (inputSize < 4 || inputSize > 10) {
      setShowError(true);
      setErrorMessage("Length should be between 4 and 10 characters");
      return false;
    }

    if (!alphanumericRegex.test(value)) {
      setShowError(true);
      setErrorMessage("Room name should only include letters and numbers");
      return false;
    }

    if (playerName.trim().length > 24) {
      setShowError(true);
      setErrorMessage("Display name should be 24 characters or fewer");
      return false;
    }

    setShowError(false);
    return true;
  };

  const handleSubmit = (): void => {
    if (validateInput(roomName.length)) {
      setIsJoining(true);
      const nickname = playerName.trim();

      if (nickname) {
        localStorage.setItem("guessTheWordPlayerName", nickname);
      } else {
        localStorage.removeItem("guessTheWordPlayerName");
      }

      socket.emit("joinRoom", { roomName, nickname });
    }
  };

  const handleRoomNameChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = e.target.value;
    setRoomName(value);

    if (value.length > 0) {
      validateInput(value.length, value);
    } else {
      setShowError(false);
    }
  };

  const handlePlayerNameChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = e.target.value;
    setPlayerName(value);

    if (value.trim().length <= 24) {
      setShowError(false);
    } else {
      setShowError(true);
      setErrorMessage("Display name should be 24 characters or fewer");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && roomName && !showError) {
      handleSubmit();
    }
  };

  return (
    <Container fluid className="mainContainer">
      {/* Hero Section */}
      <div className="hero-section">
        <h1 className="hero-title">🎮 Guess The Word</h1>
        <p className="hero-subtitle">
          The Ultimate Multiplayer Word Guessing Game
        </p>
        <p className="hero-description">
          Join friends in an exciting word guessing adventure! One player
          describes, others guess, and everyone has fun. Create or join a room
          to start playing instantly with video chat support.
        </p>
      </div>

      {/* Join Room Card */}
      <div className="join-room-card">
        <h2 className="card-title">🚀 Join a Room</h2>

        <div className="error-container">
          {showError && <Alert className="error-alert">{errorMessage}</Alert>}
        </div>

        <input
          type="text"
          className="room-input"
          placeholder="Enter Room Name (4-10 characters)"
          value={roomName}
          onChange={handleRoomNameChange}
          onKeyPress={handleKeyPress}
          disabled={isJoining}
        />

        <input
          type="text"
          className="room-input name-input"
          placeholder="Display Name (optional)"
          value={playerName}
          onChange={handlePlayerNameChange}
          onKeyPress={handleKeyPress}
          disabled={isJoining}
          maxLength={24}
        />

        <button
          className={`submit-button ${isJoining ? "loading" : ""}`}
          onClick={handleSubmit}
          disabled={isJoining || !roomName || showError}
        >
          {isJoining ? "🔄 Joining..." : "🎯 Join Game"}
        </button>
      </div>

      <div className="features-section">
        <div className="feature-card">
          <div className="feature-icon">🎥</div>
          <h3 className="feature-title">Video Chat</h3>
          <p className="feature-description">
            See and interact with your friends through integrated video chat
            while playing
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">👥</div>
          <h3 className="feature-title">Team Play</h3>
          <p className="feature-description">
            Form teams and compete against each other in exciting word guessing
            challenges
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h3 className="feature-title">Real-time</h3>
          <p className="feature-description">
            Instant synchronization and live updates for seamless multiplayer
            experience
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🏆</div>
          <h3 className="feature-title">Scoring</h3>
          <p className="feature-description">
            Track your team&apos;s progress with live scoring and competitive
            gameplay
          </p>
        </div>
      </div>
    </Container>
  );
};
