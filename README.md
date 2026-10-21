# Guess The Word — Match Mode

A two-team party game with host-controlled matches, rotating describers, private words, live scores, results, and rematches. This repository contains the frontend. The companion [backend](https://github.com/Guess-the-word/Guess-The-Word-Backend) owns match state and scoring. Deploy both Match Mode changes together.

## Run locally

Install each project's dependencies with `npm ci` if needed. In two terminals, with the repositories checked out next to each other, from this frontend directory:

```sh
npm run dev --prefix ../Guess-The-Word-Backend
```

```sh
npm start
```

Open http://localhost:3000. The backend defaults to port 4000. `PORT` and `HOST` configure the backend listener; `FRONTEND_ORIGIN` configures its Socket.IO CORS origin. The frontend uses `REACT_APP_SOCKET_URL` when set, otherwise http://localhost:4000.

## Rules and lifecycle

- First connected player hosts. The host chooses 3/5/7 rounds and 30/60/90 seconds per turn; defaults are 3 rounds and 60 seconds.
- Each round contains Team 1's turn followed by Team 2's turn. A correct guess or the describer's Correct button awards the active team one point. Correct, Pass, and expiry each end the turn.
- Any participating non-describer can submit a guess. Only the describer can mark Correct or Pass. Only the describer receives the active secret word.
- Both teams need a player before starting. Teams and settings lock during play. Describers rotate within their team.
- After the last turn, everyone sees the winner or draw, final scores, and round-by-round outcomes. The host's Play again returns everyone to the lobby with teams/settings retained and match data cleared.
- Arrivals during play or results appear in **Waiting for next match**. They get a team when the lobby reopens. Leaving as a spectator does not interrupt play.
- Any active participant leaving cancels the match with an explanation. Host ownership always passes to the earliest remaining member. Completed results survive departures.
- Refresh/disconnect is a departure, followed by a new connection if the player returns. Display names may be reused; equal names are displayed with separate numbered labels and never merge connections.
- Room state is in memory and disappears when the room empties or the server restarts.

The server validates membership, roles, settings, match/turn identifiers, and turn deadlines. Repeated or stale requests cannot score twice, skip a turn, restart a running match, or reset a newer match. Guesses are judged against the server's deadline: actions arriving at or after it earn no point.

## Automated verification

Run with the repositories checked out next to each other, from this frontend directory:

```sh
npm run build --prefix ../Guess-The-Word-Backend
npm test --prefix ../Guess-The-Word-Backend -- --runInBand
npm run lint --prefix ../Guess-The-Word-Backend
CI=true npm test -- --watchAll=false --runInBand
npm run build
node scripts/test-multiplayer.cjs
```

The integration script uses the frontend's installed Socket.IO client and the compiled backend. It creates a temporary loopback server, checks real multiplayer messages, plays a full 2–1 match including a real 30-second timeout, verifies results across clients, and checks rematches, unauthorized actions, spectators, disconnects, host transfer, and fresh-room cleanup. It closes its server and clients afterward. It does not touch rooms in your running app.

There are 28 backend tests and 15 frontend tests, plus the integration script. Existing Create React App/Babel and Browserslist dependency warnings may appear. The delayed Babel warning can keep the test process alive briefly; `--detectOpenHandles` identifies it as a dependency warning timer.

## Manual acceptance test

1. Open two sessions, give them different names, and join the same room. The first is host; one player should be on each team. Confirm only the host can change settings/start. Moving everyone onto one team must disable Start.
2. Choose 3 rounds and 30 seconds. Play this sequence:

   | Round | Team 1 | Team 2 | Cumulative score |
   | --- | --- | --- | --- |
   | 1 | Correct (use a typed guess) | Pass | 1–0 |
   | 2 | Pass | Correct (use the button) | 1–1 |
   | 3 | Correct | Time expires | 2–1 |

3. Confirm synchronized turns/timers, no secret word on the guesser's screen, exactly six turns, the 2–1 winner, and the matching recap. Rapid clicks must not add points or skip turns.
4. Join a third session during play or results. It should be explicitly waiting, with no guess/team controls. Reusing a saved name must still show a distinct player. Close a spectator: the match continues.
5. Choose Play again as host. Confirm everyone returns to the lobby, spectators get teams, scores/history clear, settings/teams remain, and the next match does not start automatically. Pass all six turns to check a 0–0 draw.
6. During a new match, close or refresh any participant. The remaining players should see a canceled-match explanation and a clean lobby. If the host leaves, the earliest remaining player becomes host.
7. Leave after results: results remain. Close every session and reuse the room name: defaults and a fresh room return.
8. Check at a narrow mobile width and with keyboard navigation. Camera/microphone capture and real media exchange remain a manual check; browser verification for this change did not enable those permissions.

Use separate browser profiles/browsers for independent saved names. Multiple Chrome incognito windows share the same incognito storage session until all are closed; the app still treats their live connections as separate players.
