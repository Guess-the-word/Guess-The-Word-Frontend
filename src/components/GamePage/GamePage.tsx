import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
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
  skipped?: boolean;
  team?: number;
  word?: string;
}

const TEAM_IDS = ["1", "2"];
const GAME_DURATION = 60;

export const GamePage: React.FC = () => {
  const { roomName } = useParams();
  const navigate = useNavigate();

  const [socketId, setSocketId] = useState(socket.id || "");
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
  const [nicknames, setNicknames] = useState<NicknameMap>({});
  const [notice, setNotice] = useState("");
  const [inviteCopied, setInviteCopied] = useState(false);
  const [isGuessConsoleMinimized, setIsGuessConsoleMinimized] = useState(false);

  const isDescriber = socketId === describer;
  const myTeam = useMemo(() => {
    return (
      Object.entries(teams).find(([, members]) =>
        members.includes(socketId)
      )?.[0] || null
    );
  }, [teams, socketId]);

  const canStartGame =
    status === "waiting" &&
    players.length >= 2 &&
    TEAM_IDS.every((teamId) => (teams[teamId] || []).length > 0);

  const lobbyHint = useMemo(() => {
    if (status === "playing") return "";
    if (players.length < 2) return "Waiting for one more player.";
    if (!TEAM_IDS.every((teamId) => (teams[teamId] || []).length > 0)) {
      return "Each team needs a player.";
    }
    return "Ready to start.";
  }, [players.length, status, teams]);

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [roomName]);

  useEffect(() => {
    const syncSocketId = (): void => setSocketId(socket.id || "");

    syncSocketId();
    socket.on("connect", syncSocketId);

    return () => {
      socket.off("connect", syncSocketId);
    };
  }, []);

  useEffect(() => {
    if (!roomName) return;

    const nickname = localStorage.getItem("guessTheWordPlayerName") || "";
    socket.emit("joinRoom", { roomName, nickname });

    const handleRoomUpdate = (data: {
      players: string[];
      teams: TeamMap;
      status: "waiting" | "playing";
      score: ScoreMap;
      currentTeam: number;
      describer?: string | null;
      timeLeft?: number;
      nicknames?: NicknameMap;
    }): void => {
      setPlayers(data.players);
      setTeams(data.teams);
      setStatus(data.status);
      setScore(data.score);
      setCurrentTeam(data.currentTeam);
      setDescriber(data.describer || null);
      setTimeLeft(data.timeLeft || 0);
      setNicknames(data.nicknames || {});

      if (data.status === "waiting") {
        setMyWord("");
      }
    };

    const handleGameStarted = (data: {
      status: "playing";
      currentTeam: number;
      describer: string | null;
      score: ScoreMap;
      timeLeft?: number;
    }): void => {
      setStatus(data.status);
      setCurrentTeam(data.currentTeam);
      setDescriber(data.describer);
      setScore(data.score);
      setTimeLeft(data.timeLeft || GAME_DURATION);
      setMyWord("");
      setNotice("");
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    };

    const handleNextTurn = (data: {
      currentTeam: number;
      describer: string | null;
      score: ScoreMap;
      timeLeft?: number;
    }): void => {
      setCurrentTeam(data.currentTeam);
      setDescriber(data.describer);
      setScore(data.score);
      setTimeLeft(data.timeLeft || GAME_DURATION);
      setMyWord("");
      setNotice("");
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
    };

    socket.on("roomUpdate", handleRoomUpdate);
    socket.on("gameStarted", handleGameStarted);
    socket.on("yourWord", ({ word }: { word: string }) => {
      setMyWord(word);
    });
    socket.on("timerUpdate", ({ timeLeft }: { timeLeft: number }) => {
      setTimeLeft(timeLeft);
    });
    socket.on("timeUp", () => {
      setGuessLog((prev) => [
        ...prev,
        { guess: "Time expired", correct: false, skipped: true },
      ]);
    });
    socket.on("nextTurn", handleNextTurn);
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
    socket.on("wordPassed", (data: { team: number; word: string }) => {
      setGuessLog((prev) => [
        ...prev,
        {
          guess: "Passed",
          correct: false,
          skipped: true,
          team: data.team,
          word: data.word,
        },
      ]);
    });
    socket.on("startRejected", ({ reason }: { reason: string }) => {
      setNotice(reason);
    });
    socket.on("actionRejected", ({ reason }: { reason: string }) => {
      setNotice(reason);
    });
    socket.on("gamePaused", ({ reason }: { reason: string }) => {
      setNotice(reason);
      setStatus("waiting");
      setMyWord("");
    });

    return () => {
      socket.off("roomUpdate", handleRoomUpdate);
      socket.off("gameStarted", handleGameStarted);
      socket.off("yourWord");
      socket.off("timerUpdate");
      socket.off("timeUp");
      socket.off("nextTurn", handleNextTurn);
      socket.off("guessResult");
      socket.off("wordPassed");
      socket.off("startRejected");
      socket.off("actionRejected");
      socket.off("gamePaused");
    };
  }, [roomName]);

  const handleStartGame = (): void => {
    if (!canStartGame) {
      setNotice(lobbyHint);
      return;
    }

    socket.emit("startGame", { roomName });
  };

  const handleGuessSubmit = (): void => {
    const trimmedGuess = guess.trim();
    if (!trimmedGuess) return;

    socket.emit("guessWord", { roomName, guess: trimmedGuess });
    setGuess("");
  };

  const handleCorrectWord = (): void => {
    socket.emit("correctWord", { roomName });
  };

  const handleSkipWord = (): void => {
    socket.emit("skipWord", { roomName });
  };

  const handleNewGame = (): void => {
    socket.emit("resetGame", { roomName });
    setGuessLog([]);
    setNotice("");
  };

  const handleLeaveGame = (): void => {
    socket.emit("leaveRoom", { roomName });
    navigate("/");
  };

  const handleSwitchTeam = (teamId: string): void => {
    if (status !== "waiting" || myTeam === teamId) return;
    socket.emit("switchTeam", { roomName, newTeam: teamId });
  };

  const handleCopyInvite = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setInviteCopied(true);
      window.setTimeout(() => setInviteCopied(false), 1800);
    } catch {
      setNotice("Could not copy the invite link.");
    }
  };

  const toggleGuessConsole = (): void => {
    setIsGuessConsoleMinimized(!isGuessConsoleMinimized);
  };

  const getName = (id: string): string => {
    return nicknames[id] || id;
  };

  const describerName = describer ? getName(describer) : "Waiting";

  return (
    <Container fluid className="game-page">
      <header className="room-header">
        <div>
          <span className="room-eyebrow">Room</span>
          <h2>{roomName}</h2>
        </div>
        <div className="room-actions">
          <Button className="secondary-action" onClick={handleCopyInvite}>
            {inviteCopied ? "Copied" : "Copy Invite"}
          </Button>
          <Button className="leave-action" onClick={handleLeaveGame}>
            Leave Game
          </Button>
        </div>
      </header>

      <section className={`play-hud ${status}`}>
        <div className="status-grid">
          <div className="status-item">
            <div className="status-label">Status</div>
            <div className="status-value">{status}</div>
          </div>
          <div className="status-item">
            <div className="status-label">Team Up</div>
            <div className="status-value">Team {currentTeam}</div>
          </div>
          <div className="status-item timer-item">
            <div className="status-label">Timer</div>
            <div className="status-value">{timeLeft}s</div>
          </div>
          <div className="status-item">
            <div className="status-label">Describer</div>
            <div className="status-value">{describerName}</div>
          </div>
        </div>

        <div className="hud-action">
          {status === "waiting" ? (
            <>
              <div className="lobby-message">{notice || lobbyHint}</div>
              <div className="lobby-actions">
                <Button
                  className="primary-action"
                  onClick={handleStartGame}
                  disabled={!canStartGame}
                >
                  Start Game
                </Button>
                <Button className="secondary-action" onClick={handleNewGame}>
                  Reset
                </Button>
              </div>
            </>
          ) : isDescriber ? (
            <div className="word-control">
              <div>
                <span className="word-label">Your word</span>
                <strong>{myWord || "Loading..."}</strong>
              </div>
              <div className="word-actions">
                <Button className="primary-action" onClick={handleCorrectWord}>
                  Correct
                </Button>
                <Button className="secondary-action" onClick={handleSkipWord}>
                  Pass
                </Button>
              </div>
            </div>
          ) : (
            <div className="guess-control">
              <Form.Control
                type="text"
                placeholder="Enter a guess"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGuessSubmit()}
              />
              <Button className="primary-action" onClick={handleGuessSubmit}>
                Guess
              </Button>
            </div>
          )}
        </div>
      </section>

      <Row className="game-layout">
        <Col lg={8}>
          <VideoChat
            roomName={roomName || ""}
            players={players}
            nicknames={nicknames}
          />
        </Col>

        <Col lg={4}>
          <div className="game-panel players-box">
            <h3>Players</h3>
            {players.length === 0 ? (
              <div className="empty-state">Waiting...</div>
            ) : (
              players.map((p) => (
                <div key={p} className="player-item">
                  <span>{getName(p)}</span>
                  {p === describer && (
                    <span className="describer-badge">Describer</span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="game-panel teams-box">
            <h3>Teams</h3>
            {TEAM_IDS.map((teamId) => {
              const members = teams[teamId] || [];

              return (
                <div
                  key={teamId}
                  className={`team-container ${
                    myTeam === teamId ? "is-mine" : ""
                  }`}
                >
                  <div className="team-header">
                    <span className="team-name">Team {teamId}</span>
                    <span className="team-score">
                      Score: {score[teamId] || 0}
                    </span>
                  </div>
                  <ul className="team-members">
                    {members.length === 0 ? (
                      <li className="empty-state">Open seat</li>
                    ) : (
                      members.map((m) => <li key={m}>{getName(m)}</li>)
                    )}
                  </ul>
                  {status === "waiting" && (
                    <Button
                      size="sm"
                      className="team-join-button"
                      disabled={myTeam === teamId}
                      onClick={() => handleSwitchTeam(teamId)}
                    >
                      {myTeam === teamId ? "Your Team" : "Join Team"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          <div
            className={`game-panel guess-console ${
              isGuessConsoleMinimized ? "minimized" : ""
            }`}
          >
            <div className="console-header">
              <h3>Guesses</h3>
              <button
                type="button"
                className="toggle-button"
                onClick={toggleGuessConsole}
              >
                {isGuessConsoleMinimized ? "Show" : "Hide"}
              </button>
            </div>

            {!isGuessConsoleMinimized && (
              <div className="console-content">
                {guessLog.length === 0 ? (
                  <div className="empty-state">No guesses yet...</div>
                ) : (
                  guessLog.map((logItem, idx) => {
                    if (logItem.correct) {
                      return (
                        <div key={idx} className="console-item console-correct">
                          <strong>Team {logItem.team}</strong> got{" "}
                          {logItem.guess}.
                        </div>
                      );
                    }

                    if (logItem.skipped) {
                      return (
                        <div key={idx} className="console-item console-pass">
                          {logItem.team
                            ? `Team ${logItem.team} passed ${logItem.word}.`
                            : logItem.guess}
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="console-item console-incorrect">
                        {logItem.guess} missed.
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  );
};
