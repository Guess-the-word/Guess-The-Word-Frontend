/**
 * File: /src/components/GamePage/GamePage.tsx
 */
import React, { useEffect, useState } from "react";
import { socket } from "../../services/socket";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Alert, Form, Container, Row, Col } from "react-bootstrap";

// Use string keys for team IDs
interface TeamMap {
  [teamId: string]: string[];
}

interface ScoreMap {
  [teamId: string]: number;
}

export const GamePage = () => {
  const { roomName } = useParams();
  const navigate = useNavigate();

  const [players, setPlayers] = useState<string[]>([]);
  const [teams, setTeams] = useState<TeamMap>({});
  const [status, setStatus] = useState<"waiting" | "playing">("waiting");
  const [currentTeam, setCurrentTeam] = useState<number>(1);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [describer, setDescriber] = useState<string | null>(null);
  const [myWord, setMyWord] = useState<string>("");
  const [guess, setGuess] = useState<string>("");
  // Also use string-based keys here
  const [score, setScore] = useState<ScoreMap>({});

  useEffect(() => {
    if (!roomName) return;

    // If user directly navigated here, we want to ensure we join the room
    socket.emit("joinRoom", { roomName });

    // General room updates
    socket.on("roomUpdate", (data) => {
      setPlayers(data.players);
      setTeams(data.teams);
      setStatus(data.status);
      setScore(data.score);
      setCurrentTeam(data.currentTeam);
    });

    // Game started
    socket.on("gameStarted", (data) => {
      setStatus(data.status);
      setCurrentTeam(data.currentTeam);
      setDescriber(data.describer);
      setScore(data.score);
      setMyWord(""); // clear previous word
    });

    // The word for me to describe
    socket.on("yourWord", ({ word }) => {
      setMyWord(word);
    });

    // Timer updates
    socket.on("timerUpdate", ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    });

    // Time's up
    socket.on("timeUp", () => {
      alert("Time is up!");
    });

    // Next turn
    socket.on("nextTurn", (data) => {
      setCurrentTeam(data.currentTeam);
      setDescriber(data.describer);
      setScore(data.score);
      setMyWord("");
    });

    // Correct guess
    socket.on("correctGuess", (data) => {
      alert(`Team ${data.team} guessed the word "${data.word}"!`);
      setScore(data.score);
    });

    // Cleanup listeners on unmount
    return () => {
      socket.off("roomUpdate");
      socket.off("gameStarted");
      socket.off("yourWord");
      socket.off("timerUpdate");
      socket.off("timeUp");
      socket.off("nextTurn");
      socket.off("correctGuess");
    };
  }, [roomName]);

  const handleStartGame = () => {
    socket.emit("startGame", { roomName });
  };

  const handleGuessSubmit = () => {
    if (!guess) return;
    socket.emit("guessWord", { roomName, guess });
    setGuess("");
  };

  const isDescriber = socket.id === describer;

  return (
    <Container>
      <Row>
        <Col>
          <h2>Room: {roomName}</h2>
          <p>Status: {status}</p>
          <p>Current Team: {currentTeam}</p>
          <p>Time Left: {timeLeft}</p>
        </Col>
      </Row>

      <Row>
        <Col>
          <h3>Players</h3>
          {players.map((p) => (
            <div key={p}>
              {p} {p === describer ? "(Describer)" : ""}
            </div>
          ))}
        </Col>
        <Col>
          <h3>Teams</h3>
          {Object.entries(teams).map(([teamId, members]) => (
            <div key={teamId}>
              <strong>
                Team {teamId} (Score: {score[teamId] || 0}):
              </strong>
              <ul>
                {members.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          ))}
        </Col>
      </Row>

      {status === "waiting" && (
        <Button onClick={handleStartGame} className="mt-3">
          Start Game
        </Button>
      )}

      {status === "playing" && (
        <div className="mt-3">
          {isDescriber ? (
            <Alert variant="info">
              <strong>Your word:</strong> {myWord}
            </Alert>
          ) : (
            <Form.Group as={Row}>
              <Col sm={6}>
                <Form.Control
                  type="text"
                  placeholder="Your Guess"
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                />
              </Col>
              <Col sm={2}>
                <Button onClick={handleGuessSubmit}>Guess!</Button>
              </Col>
            </Form.Group>
          )}
        </div>
      )}
    </Container>
  );
};
