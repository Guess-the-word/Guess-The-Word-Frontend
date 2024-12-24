import React, { useEffect, useState } from "react";
import { socket } from "../../services/socket";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Alert, Form, Container, Row, Col } from "react-bootstrap";
import { VideoChat } from "./VideoChat"; // <-- WebRTC-based component

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
  const [score, setScore] = useState<ScoreMap>({});

  useEffect(() => {
    if (!roomName) return;
    socket.emit("joinRoom", { roomName });

    socket.on("roomUpdate", (data) => {
      setPlayers(data.players);
      setTeams(data.teams);
      setStatus(data.status);
      setScore(data.score);
      setCurrentTeam(data.currentTeam);
    });

    socket.on("gameStarted", (data) => {
      setStatus(data.status);
      setCurrentTeam(data.currentTeam);
      setDescriber(data.describer);
      setScore(data.score);
      setMyWord("");
    });

    socket.on("yourWord", ({ word }) => {
      setMyWord(word);
    });

    socket.on("timerUpdate", ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    });

    socket.on("timeUp", () => {
      alert("Time is up!");
    });

    socket.on("nextTurn", (data) => {
      setCurrentTeam(data.currentTeam);
      setDescriber(data.describer);
      setScore(data.score);
      setMyWord("");
    });

    socket.on("correctGuess", (data) => {
      alert(`Team ${data.team} guessed the word "${data.word}"!`);
      setScore(data.score);
    });

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
    <Container fluid style={{ marginTop: "2rem" }}>
      <Row>
        <Col md={8}>
          <h2>Room: {roomName}</h2>
          <p>
            <strong>Status:</strong> {status}
          </p>
          <p>
            <strong>Current Team:</strong> {currentTeam}
          </p>
          <p>
            <strong>Time Left:</strong> {timeLeft}
          </p>
        </Col>
        <Col md={4}>
          <div
            style={{ background: "#fafafa", padding: "1rem", borderRadius: 8 }}
          >
            <h3>Players</h3>
            {players.map((p) => (
              <div key={p}>
                {p} {p === describer ? "(Describer)" : ""}
              </div>
            ))}
          </div>
        </Col>
      </Row>

      <Row className="mt-3">
        <Col md={8}>
          {/* 2x2 WebRTC video chat */}
          <VideoChat roomName={roomName || ""} players={players} />
        </Col>
        <Col md={4}>
          <div
            style={{ background: "#fafafa", padding: "1rem", borderRadius: 8 }}
          >
            <h3>Teams</h3>
            {Object.entries(teams).map(([teamId, members]) => (
              <div key={teamId} style={{ marginBottom: "1rem" }}>
                <strong>
                  Team {teamId} (Score: {score[teamId] || 0}):
                </strong>
                <ul style={{ listStyleType: "circle", marginLeft: "1.5rem" }}>
                  {members.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Col>
      </Row>

      {status === "waiting" && (
        <Button onClick={handleStartGame} className="mt-4">
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
            <Form.Group as={Row} style={{ marginTop: "1rem" }}>
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
