import React, { useEffect, useState } from "react";
import { socket } from "../../services/socket";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Alert, Form, Container, Row, Col } from "react-bootstrap";
import { VideoChat } from "./VideoChat"; // If you have WebRTC
import "./GamePage.css";

interface TeamMap {
  [teamId: string]: string[];
}
interface ScoreMap {
  [teamId: string]: number;
}
interface NicknameMap {
  [socketId: string]: string;
}

interface GuessLogEntry {
  guess: string;
  correct: boolean;
  team?: number;
  word?: string;
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
  const [guessLog, setGuessLog] = useState<GuessLogEntry[]>([]);
  const [nicknames, setNicknames] = useState<NicknameMap>({}); // NEW: silly names

  const isDescriber = socket.id === describer;

  useEffect(() => {
    if (!roomName) return;
    socket.emit("joinRoom", { roomName });

    socket.on("roomUpdate", (data) => {
      setPlayers(data.players);
      setTeams(data.teams);
      setStatus(data.status);
      setScore(data.score);
      setCurrentTeam(data.currentTeam);
      // store nicknames
      setNicknames(data.nicknames || {});
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
      setGuessLog((prev) => [...prev, { guess: "Time's up!", correct: false }]);
    });

    socket.on("nextTurn", (data) => {
      setCurrentTeam(data.currentTeam);
      setDescriber(data.describer);
      setScore(data.score);
      setMyWord("");
    });

    socket.on("guessResult", (data) => {
      if (data.correct) {
        setGuessLog((prev) => [
          ...prev,
          {
            guess: data.guess,
            correct: true,
            team: data.team,
            word: data.word,
          },
        ]);
        setScore(data.score);
      } else {
        setGuessLog((prev) => [...prev, { guess: data.guess, correct: false }]);
      }
    });

    return () => {
      socket.off("roomUpdate");
      socket.off("gameStarted");
      socket.off("yourWord");
      socket.off("timerUpdate");
      socket.off("timeUp");
      socket.off("nextTurn");
      socket.off("guessResult");
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

  const handleNewGame = () => {
    socket.emit("resetGame", { roomName });
    setGuessLog([]);
  };

  // Helper: get a user’s silly name from the ID
  const getName = (id: string) => {
    return nicknames[id] || id;
  };

  return (
    <Container fluid>
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
          <div className="game-panel players-box">
            <h3>Players</h3>
            {players.map((p) => (
              <div key={p}>
                {getName(p)} {p === describer ? "(Describer)" : ""}
              </div>
            ))}
          </div>
        </Col>
      </Row>

      <Row className="mt-3">
        <Col md={8}>
          {/* 2x2 WebRTC video chat */}
          <div className="videoChatContainer">
            <VideoChat roomName={roomName || ""} players={players} />
          </div>
        </Col>
        <Col md={4}>
          <div className="game-panel teams-box">
            <h3>Teams</h3>
            {Object.entries(teams).map(([teamId, members]) => (
              <div key={teamId} style={{ marginBottom: "1rem" }}>
                <strong>
                  Team {teamId} (Score: {score[teamId] || 0})
                </strong>
                <ul style={{ listStyleType: "circle", marginLeft: "1.5rem" }}>
                  {members.map((m) => (
                    <li key={m}>{getName(m)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Col>
      </Row>

      {status === "waiting" && (
        <>
          <Button onClick={handleStartGame} className="mt-4">
            Start Game
          </Button>{" "}
          <Button
            variant="outline-primary"
            onClick={handleNewGame}
            className="mt-4"
          >
            Reset Game
          </Button>
        </>
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
          <Button
            variant="outline-primary"
            onClick={handleNewGame}
            className="mt-4"
          >
            New Game
          </Button>
        </div>
      )}

      {/* Guess console at bottom-right */}
      <div className="guess-console">
        <h4>Guesses</h4>
        {guessLog.map((logItem, idx) => {
          if (logItem.correct) {
            return (
              <div key={idx} className="console-item console-correct">
                <strong>Team {logItem.team}</strong> guessed “{logItem.guess}”
                correctly!
                {logItem.word && ` (Word: ${logItem.word})`}
              </div>
            );
          } else {
            return (
              <div key={idx} className="console-item console-incorrect">
                Guessed “{logItem.guess}” — Incorrect.
              </div>
            );
          }
        })}
      </div>
    </Container>
  );
};
