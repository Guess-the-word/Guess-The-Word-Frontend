import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VideoChat } from "./VideoChat";
import { Team, TurnResult } from "./matchTypes";
import { useMatchRoom } from "./useMatchRoom";
import "./GamePage.css";

const TEAMS: Team[] = ["1", "2"];
const outcomeLabel = (turn: TurnResult) =>
  turn.outcome === "correct"
    ? "+1 · Correct"
    : turn.outcome === "passed"
    ? "0 · Passed"
    : "0 · Time expired";

export const GamePage: React.FC = () => {
  const { roomName = "" } = useParams();
  const navigate = useNavigate();
  const { room, playerId, connection, error, pending, send } =
    useMatchRoom(roomName);
  const [guess, setGuess] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  useEffect(() => {
    setGuess("");
  }, [room?.matchId, room?.turnId, room?.lobbyId]);
  useEffect(() => {
    if (!inviteMessage) return;
    const timeout = window.setTimeout(() => setInviteMessage(""), 3000);
    return () => window.clearTimeout(timeout);
  }, [inviteMessage]);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setInviteMessage("Invite copied");
    } catch {
      setInviteMessage("Copy the room URL from your address bar.");
    }
  };
  const header = (
    <header className="room-header">
      <div>
        <span className="room-eyebrow">Guess the Word / Match Mode</span>
        <h1>{roomName}</h1>
      </div>
      <div className="room-actions">
        <button className="room-button" onClick={copyInvite}>
          Copy invite
        </button>
        <button className="room-button" onClick={() => navigate("/")}>
          Leave room
        </button>
      </div>
    </header>
  );
  if (!room)
    return (
      <main className="game-page">
        {header}
        <section className="match-card connection-card" aria-live="polite">
          <h2>{error ? "Unable to join" : "Getting your seat ready"}</h2>
          <p>{error || connection}</p>
          <button className="primary-action" onClick={() => navigate("/")}>
            Back to home
          </button>
        </section>
      </main>
    );
  const host = room.hostId === playerId;
  const waiting = room.waitingPlayers.includes(playerId);
  const myTeam = TEAMS.find((team) => room.teams[team].includes(playerId));
  const describing = room.status === "playing" && room.describer === playerId;
  const ready = TEAMS.every((team) => room.teams[team].length > 0);
  const name = (id: string) => {
    const base = room.nicknames[id] || "Player";
    const duplicates = room.players.filter(
      (other) => room.nicknames[other] === base
    );
    return duplicates.length > 1
      ? `${base} · ${duplicates.indexOf(id) + 1}`
      : base;
  };
  const player = (id: string) => (
    <li key={id} className="member-row">
      <span className="member-name">
        {name(id)}
        {id === playerId && <small> (you)</small>}
      </span>
      <span className="member-badges">
        {id === room.hostId && <span className="badge-host">Host</span>}
        {room.status === "playing" && id === room.describer && (
          <span className="badge-describer">Describing</span>
        )}
      </span>
    </li>
  );
  const submitGuess = (event: React.FormEvent) => {
    event.preventDefault();
    if (!guess.trim() || pending) return;
    send("guessWord", { guess: guess.trim() });
    setGuess("");
  };

  return (
    <main className="game-page">
      {header}
      <div className="room-meta">
        <span className={`phase-pill ${room.status}`}>
          {room.status === "waiting"
            ? "Lobby"
            : room.status === "playing"
            ? "Match in progress"
            : "Match complete"}
        </span>
        <span>
          {room.players.length} in room · Hosted by {name(room.hostId)}
        </span>
        <span>{waiting ? "You’re watching" : `You’re on Team ${myTeam}`}</span>
      </div>
      {inviteMessage && (
        <p className="room-toast" role="status">
          {inviteMessage}
        </p>
      )}
      {error && (
        <div className="match-alert error" role="alert">
          {error}
        </div>
      )}
      {room.notice && (
        <div className="match-alert" role="status">
          {room.notice}
        </div>
      )}
      {waiting && (
        <div className="waiting-banner" role="status">
          <span className="waiting-symbol" aria-hidden="true">
            ◷
          </span>
          <div>
            <strong>Waiting for the next match</strong>
            <p>
              You joined after this match started. You can watch now; you’ll get
              a team when the host returns everyone to the lobby.
            </p>
          </div>
        </div>
      )}

      <div className="match-layout">
        <div className="match-main">
          {room.status === "waiting" && (
            <section className="match-card setup-card">
              <span className="section-eyebrow">
                A little competition. A lot of fun.
              </span>
              <h2>Make it a match.</h2>
              <p className="section-description">
                Choose your teams, set the pace, and let the guessing begin.
              </p>
              <div className="settings-grid">
                <fieldset disabled={!host || pending}>
                  <legend>Rounds</legend>
                  <div className="choice-group">
                    {[3, 5, 7].map((rounds) => (
                      <button
                        key={rounds}
                        aria-label={`${rounds} rounds`}
                        aria-pressed={room.settings.rounds === rounds}
                        onClick={() =>
                          send("updateSettings", { ...room.settings, rounds })
                        }
                      >
                        {rounds}
                      </button>
                    ))}
                  </div>
                  <p>Each team gets one turn per round.</p>
                </fieldset>
                <fieldset disabled={!host || pending}>
                  <legend>Time per turn</legend>
                  <div className="choice-group">
                    {[30, 60, 90].map((turnSeconds) => (
                      <button
                        key={turnSeconds}
                        aria-label={`${turnSeconds} seconds`}
                        aria-pressed={room.settings.turnSeconds === turnSeconds}
                        onClick={() =>
                          send("updateSettings", {
                            ...room.settings,
                            turnSeconds,
                          })
                        }
                      >
                        {turnSeconds}
                        <small>s</small>
                      </button>
                    ))}
                  </div>
                  <p>One word to guess before time runs out.</p>
                </fieldset>
              </div>
              <div className="match-summary">
                <span>{room.settings.rounds * 2} turns</span>
                <span>{room.settings.turnSeconds}s per turn</span>
                <span>1 point per correct word</span>
              </div>
              <div className="setup-footer">
                <div>
                  <strong>
                    {ready
                      ? "Both teams are ready."
                      : "Every team needs a player."}
                  </strong>
                  <p>
                    {host
                      ? "Team 1 goes first. Settings lock when you start."
                      : `Waiting for ${name(room.hostId)} to start the match.`}
                  </p>
                </div>
                {host && (
                  <button
                    className="primary-action"
                    disabled={!ready || pending}
                    onClick={() => send("startGame")}
                  >
                    Start match <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {room.status === "playing" && (
            <section
              className={`match-card turn-card team-${room.currentTeam}`}
            >
              <div className="turn-heading">
                <div>
                  <span className="section-eyebrow">
                    Round {room.round} of {room.settings.rounds}
                  </span>
                  <h2>Team {room.currentTeam}, you’re up.</h2>
                </div>
                <div
                  className={`turn-timer ${
                    room.timeLeft <= 10 ? "urgent" : ""
                  }`}
                  role="timer"
                  aria-label={`${room.timeLeft} seconds remaining`}
                >
                  <strong>{room.timeLeft}</strong>
                  <span>seconds</span>
                </div>
              </div>
              <div className="timer-track" aria-hidden="true">
                <div
                  style={{
                    width: `${
                      (room.timeLeft / room.settings.turnSeconds) * 100
                    }%`,
                  }}
                />
              </div>
              <div
                className="turn-progress"
                aria-label={`Turn ${room.turnId + 1} of ${
                  room.settings.rounds * 2
                }`}
              >
                {Array.from(
                  { length: room.settings.rounds * 2 },
                  (_, index) => (
                    <span
                      key={index}
                      className={
                        index < room.turnId
                          ? "done"
                          : index === room.turnId
                          ? "current"
                          : ""
                      }
                    />
                  )
                )}
              </div>
              {describing ? (
                <div className="secret-word">
                  <span className="section-eyebrow">
                    Your word · only you can see it
                  </span>
                  <strong>{room.yourWord}</strong>
                  <p>Describe it aloud. Mark Correct when someone gets it.</p>
                  <div className="word-actions">
                    <button
                      className="primary-action"
                      disabled={pending}
                      onClick={() => send("correctWord")}
                    >
                      Correct · +1 to Team {room.currentTeam}
                    </button>
                    <button
                      className="secondary-action"
                      disabled={pending}
                      onClick={() => send("skipWord")}
                    >
                      Pass
                    </button>
                  </div>
                </div>
              ) : (
                <div className="guess-area">
                  <h3>{name(room.describer || "")} is describing.</h3>
                  <p>
                    {waiting
                      ? "Follow along. Your turn to play comes next match."
                      : `Guess the word. A correct answer gives Team ${room.currentTeam} one point.`}
                  </p>
                  {!waiting && (
                    <form className="guess-form" onSubmit={submitGuess}>
                      <label className="sr-only" htmlFor="word-guess">
                        Your guess
                      </label>
                      <input
                        id="word-guess"
                        placeholder="What’s the word?"
                        autoComplete="off"
                        maxLength={120}
                        value={guess}
                        onChange={(event) => setGuess(event.target.value)}
                        disabled={pending}
                      />
                      <button
                        className="primary-action"
                        disabled={pending || !guess.trim()}
                      >
                        Guess
                      </button>
                    </form>
                  )}
                </div>
              )}
            </section>
          )}

          {room.status === "finished" && (
            <section
              className="match-card results-card"
              aria-label="Match results"
            >
              <span className="result-icon" aria-hidden="true">
                {room.winner === "draw" ? "✦" : "🏆"}
              </span>
              <span className="section-eyebrow">That’s a match</span>
              <h2>
                {room.winner === "draw"
                  ? "It’s a draw!"
                  : `Team ${room.winner} takes the win!`}
              </h2>
              <p className="section-description">
                {room.settings.rounds} rounds played.{" "}
                {room.winner === "draw"
                  ? "Evenly matched. Settle it in a rematch?"
                  : "Good words. Great teamwork. One more?"}
              </p>
              <div
                className="final-score"
                aria-label={`Final score: Team 1 ${room.score["1"]}, Team 2 ${room.score["2"]}`}
              >
                <div className={room.winner === "1" ? "winner" : ""}>
                  <span>Team 1</span>
                  <strong>{room.score["1"]}</strong>
                </div>
                <span className="score-divider">:</span>
                <div className={room.winner === "2" ? "winner" : ""}>
                  <span>Team 2</span>
                  <strong>{room.score["2"]}</strong>
                </div>
              </div>
              {host ? (
                <>
                  <button
                    className="primary-action"
                    disabled={pending}
                    onClick={() => send("resetGame")}
                  >
                    Play again <span aria-hidden="true">↗</span>
                  </button>
                  <p className="result-help">
                    Back to the lobby, with the same teams and settings.
                  </p>
                </>
              ) : (
                <p className="result-help">
                  Waiting for {name(room.hostId)} to choose Play again.
                </p>
              )}
            </section>
          )}

          {room.history.length > 0 && (
            <section className="match-card recap-card">
              <div className="section-heading">
                <h3>
                  {room.status === "finished"
                    ? "Round-by-round results"
                    : "The match so far"}
                </h3>
                <span>{room.history.length} turns played</span>
              </div>
              <div className="recap-scroll">
                <table>
                  <caption className="sr-only">
                    Points and words for each team by round
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Round</th>
                      <th scope="col">Team 1</th>
                      <th scope="col">Team 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(
                      { length: room.settings.rounds },
                      (_, index) => index + 1
                    )
                      .filter((round) =>
                        room.history.some((turn) => turn.round === round)
                      )
                      .map((round) => (
                        <tr key={round}>
                          <th scope="row">{round}</th>
                          {TEAMS.map((team) => {
                            const turn = room.history.find(
                              (item) =>
                                item.round === round && item.team === team
                            );
                            return (
                              <td key={team}>
                                {turn ? (
                                  <>
                                    <span className={`outcome ${turn.outcome}`}>
                                      {outcomeLabel(turn)}
                                    </span>
                                    <span className="recap-word">
                                      {turn.word}
                                    </span>
                                  </>
                                ) : (
                                  <span className="muted">Up next</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <VideoChat
            key={roomName}
            roomName={roomName}
            players={room.players}
            nicknames={room.nicknames}
          />
          {room.status === "playing" && room.guesses.length > 0 && (
            <details className="match-card guesses-card">
              <summary>
                Guesses <span>{room.guesses.length}</span>
              </summary>
              <ol>
                {room.guesses
                  .slice()
                  .reverse()
                  .map((entry, index) => (
                    <li key={index}>
                      <strong>{entry.name}</strong> guessed “{entry.guess}”{" "}
                      <small>Round {entry.round} · Not quite</small>
                    </li>
                  ))}
              </ol>
            </details>
          )}
        </div>

        <aside className="match-sidebar" aria-label="Teams and players">
          <section className="match-card teams-card">
            <div className="section-heading">
              <h3>The teams</h3>
              <span>
                {room.status === "waiting" ? "Pick your side" : "Teams locked"}
              </span>
            </div>
            {TEAMS.map((team) => (
              <div
                key={team}
                className={`team-block team-${team} ${
                  myTeam === team ? "my-team" : ""
                }`}
              >
                <div className="team-heading">
                  <h4>
                    <span className="team-dot" />
                    Team {team}
                    {myTeam === team && <small>Your team</small>}
                  </h4>
                  <span
                    className="team-points"
                    aria-label={`Team ${team} score: ${room.score[team]}`}
                  >
                    {room.score[team]}
                    <small>pts</small>
                  </span>
                </div>
                <ul className="team-members">
                  {room.teams[team].length ? (
                    room.teams[team].map(player)
                  ) : (
                    <li className="open-seat">
                      {room.status === "waiting"
                        ? "Open seat · join this team"
                        : "No players currently connected"}
                    </li>
                  )}
                </ul>
                {room.status === "waiting" && (
                  <button
                    className="team-join-button"
                    disabled={myTeam === team || pending}
                    onClick={() => send("switchTeam", { newTeam: team })}
                  >
                    {myTeam === team
                      ? "You’re on this team"
                      : `Join Team ${team}`}
                  </button>
                )}
              </div>
            ))}
          </section>
          {room.waitingPlayers.length > 0 && (
            <section className="match-card waiting-card">
              <div className="section-heading">
                <h3>Waiting for next match</h3>
                <span>{room.waitingPlayers.length}</span>
              </div>
              <p>Watching now. Joining a team when the lobby opens.</p>
              <ul className="team-members">
                {room.waitingPlayers.map(player)}
              </ul>
            </section>
          )}
          <section className="rules-card">
            <h3>One word. One point.</h3>
            <p>
              Describe without saying the word. A correct answer earns the
              active team a point. Correct, Pass, or time running out ends the
              turn.
            </p>
            <p>Each round gives both teams a turn. Most points wins.</p>
          </section>
        </aside>
      </div>
    </main>
  );
};
