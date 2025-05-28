import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Form, Container, Row, Col } from "react-bootstrap";
import { socket } from "../../services/socket";
import { VideoChat } from "./VideoChat";
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

export const GamePage: React.FC = () => {
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
  const [isGuessConsoleMinimized, setIsGuessConsoleMinimized] = useState(false);

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

  const handleStartGame = (): void => {
    socket.emit("startGame", { roomName });
  };

  const handleGuessSubmit = (): void => {
    if (!guess) return;
    socket.emit("guessWord", { roomName, guess });
    setGuess("");
  };

  const handleNewGame = (): void => {
    socket.emit("resetGame", { roomName });
    setGuessLog([]);
  };

  const handleLeaveGame = (): void => {
    socket.emit("leaveRoom", { roomName });
    navigate("/");
  };

  const toggleGuessConsole = (): void => {
    setIsGuessConsoleMinimized(!isGuessConsoleMinimized);
  };

  const getName = (id: string): string => {
    return nicknames[id] || id;
  };

  return (
    <Container fluid>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ margin: 0 }}>🎮 {roomName}</h2>
        <Button
          variant="outline-light"
          onClick={handleLeaveGame}
          style={{
            background: "rgba(255, 255, 255, 0.1)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            color: "white",
            fontWeight: "600",
            padding: "0.5rem 1.5rem",
            borderRadius: "12px",
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          🚪 Leave Game
        </Button>
      </div>

      <div className="game-info">
        <div className="status-grid">
          <div className="status-item">
            <div className="status-label">Status</div>
            <div className="status-value">{status}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Current Team</div>
            <div className="status-value">Team {currentTeam}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Time Left</div>
            <div className="status-value">{timeLeft}s</div>
          </div>
          <div className="status-item">
            <div className="status-label">Players Online</div>
            <div className="status-value">{players.length}</div>
          </div>
        </div>
      </div>

      <Row>
        <Col lg={8}>
          <div className="videoChatContainer">
            <VideoChat roomName={roomName || ""} players={players} />
          </div>
          {status === "waiting" && (
            <div className="guess-input-container">
              <div style={{ textAlign: "center" }}>
                <Button onClick={handleStartGame} className="me-3">
                  🚀 Start Game
                </Button>
                <Button variant="outline-primary" onClick={handleNewGame}>
                  🔄 Reset Game
                </Button>
              </div>
            </div>
          )}

          {status === "playing" && (
            <div className="guess-input-container">
              {isDescriber ? (
                <div className="word-display">
                  🎯 Your word: <strong>{myWord}</strong>
                </div>
              ) : (
                <Row className="align-items-center">
                  <Col md={8}>
                    <Form.Control
                      type="text"
                      placeholder="Enter your guess..."
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleGuessSubmit()
                      }
                      style={{ fontSize: "1.1rem", padding: "0.75rem" }}
                    />
                  </Col>
                  <Col md={4}>
                    <Button
                      onClick={handleGuessSubmit}
                      style={{ width: "100%" }}
                    >
                      🔮 Guess!
                    </Button>
                  </Col>
                </Row>
              )}
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                <Button variant="outline-primary" onClick={handleNewGame}>
                  🎲 New Game
                </Button>
              </div>
            </div>
          )}
        </Col>

        <Col lg={4}>
          <div className="game-panel players-box">
            <h3>👥 Players</h3>
            {players.map((p) => (
              <div key={p} className="player-item">
                <span>{getName(p)}</span>
                {p === describer && (
                  <span className="describer-badge">Describer</span>
                )}
              </div>
            ))}
          </div>

          <div className="game-panel teams-box">
            <h3>🏆 Teams</h3>
            {Object.entries(teams).map(([teamId, members]) => (
              <div key={teamId} className="team-container">
                <div className="team-header">
                  <span className="team-name">Team {teamId}</span>
                  <span className="team-score">
                    Score: {score[teamId] || 0}
                  </span>
                </div>
                <ul className="team-members">
                  {members.map((m) => (
                    <li key={m}>{getName(m)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Col>
      </Row>

      <div
        className={`guess-console ${
          isGuessConsoleMinimized ? "minimized" : ""
        }`}
      >
        <div className="console-header" onClick={toggleGuessConsole}>
          <h4>💬 Guesses</h4>
          <button className="toggle-button">
            {isGuessConsoleMinimized ? "📈" : "📉"}
          </button>
          {isGuessConsoleMinimized && guessLog.length > 0 && (
            <span className="guess-count">({guessLog.length})</span>
          )}
        </div>

        {!isGuessConsoleMinimized && (
          <div
            className="console-content"
            style={{ maxHeight: "300px", overflowY: "auto" }}
          >
            {guessLog.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  color: "#718096",
                  fontStyle: "italic",
                }}
              >
                No guesses yet...
              </div>
            ) : (
              guessLog.map((logItem, idx) => {
                if (logItem.correct) {
                  return (
                    <div key={idx} className="console-item console-correct">
                      <strong>🎉 Team {logItem.team}</strong> guessed &quot;
                      {logItem.guess}
                      &quot; correctly!
                      {logItem.word && ` (Word: ${logItem.word})`}
                    </div>
                  );
                } else {
                  return (
                    <div key={idx} className="console-item console-incorrect">
                      ❌ &quot;{logItem.guess}&quot; — Incorrect
                    </div>
                  );
                }
              })
            )}
          </div>
        )}
      </div>
    </Container>
  );
};
