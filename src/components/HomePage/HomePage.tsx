import React, { useState, useEffect } from "react";
import "./HomePage.css";
import Container from "react-bootstrap/Container";
import { Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { socket } from "../../services/socket";

export const HomePage = () => {
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState("");
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    // Listen for successful room join
    socket.on(
      "roomUpdate",
      ({ roomName }: { roomName: string; players: string[] }) => {
        setIsJoining(false);
        navigate(`/room/${roomName}`);
      }
    );

    return () => {
      socket.off("roomUpdate");
    };
  }, [navigate]);

  const validateInput = (inputSize: number) => {
    const letterNumber = /^[0-9a-zA-Z]+$/;
    if (inputSize < 4 || inputSize > 10) {
      setShowError(true);
      setErrorMessage("Length should be between 4 and 10 characters");
      return false;
    } else if (!letterNumber.test(roomName)) {
      setShowError(true);
      setErrorMessage("Room name should only include letters and numbers");
      return false;
    } else {
      setShowError(false);
      return true;
    }
  };

  const handleSubmit = () => {
    if (validateInput(roomName.length)) {
      setIsJoining(true);
      socket.emit("joinRoom", { roomName });
    }
  };

  const handleRoomNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRoomName(value);
    if (value.length > 0) {
      validateInput(value.length);
    } else {
      setShowError(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

        {/* Error Container */}
        <div className="error-container">
          {showError && <Alert className="error-alert">{errorMessage}</Alert>}
        </div>

        {/* Room Input */}
        <input
          type="text"
          className="room-input"
          placeholder="Enter Room Name (4-10 characters)"
          value={roomName}
          onChange={handleRoomNameChange}
          onKeyPress={handleKeyPress}
          disabled={isJoining}
        />

        {/* Submit Button */}
        <button
          className={`submit-button ${isJoining ? "loading" : ""}`}
          onClick={handleSubmit}
          disabled={isJoining || !roomName || showError}
        >
          {isJoining ? "🔄 Joining..." : "🎯 Join Game"}
        </button>
      </div>

      {/* Features Section */}
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
