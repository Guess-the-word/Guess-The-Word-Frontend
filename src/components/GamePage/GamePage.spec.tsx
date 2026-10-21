import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GamePage } from "./GamePage";
import { RoomState } from "./matchTypes";
import { useMatchRoom } from "./useMatchRoom";

jest.mock("./useMatchRoom");
jest.mock("./VideoChat", () => ({ VideoChat: () => <div>Video room</div> }));
const useRoom = useMatchRoom as jest.MockedFunction<typeof useMatchRoom>;
const send = jest.fn();
let room: RoomState;
const show = (id = "a") => {
  useRoom.mockReturnValue({
    room,
    playerId: id,
    connection: "",
    error: "",
    pending: false,
    send,
  });
  return render(
    <MemoryRouter
      initialEntries={["/room/testroom"]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/room/:roomName" element={<GamePage />} />
      </Routes>
    </MemoryRouter>
  );
};
beforeEach(() => {
  send.mockClear();
  room = {
    roomName: "testroom",
    players: ["a", "b"],
    nicknames: { a: "Alex", b: "Blair" },
    hostId: "a",
    teams: { "1": ["a"], "2": ["b"] },
    waitingPlayers: [],
    status: "waiting",
    settings: { rounds: 3, turnSeconds: 60 },
    lobbyId: "lobby",
    matchId: null,
    turnId: 0,
    round: 1,
    currentTeam: "1",
    describer: null,
    yourWord: null,
    timeLeft: 0,
    score: { "1": 0, "2": 0 },
    history: [],
    guesses: [],
    winner: null,
    notice: "",
  };
});
test("host configures a match and sees exact turn count", () => {
  show();
  expect(screen.getByText("6 turns")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "3 rounds" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  fireEvent.click(screen.getByRole("button", { name: "5 rounds" }));
  expect(send).toHaveBeenCalledWith("updateSettings", {
    rounds: 5,
    turnSeconds: 60,
  });
  fireEvent.click(screen.getByRole("button", { name: /Start match/ }));
  expect(send).toHaveBeenCalledWith("startGame");
});
test("non-host sees settings but cannot change them or start", () => {
  show("b");
  expect(screen.getByRole("button", { name: "5 rounds" })).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: /Start match/ })
  ).not.toBeInTheDocument();
  expect(
    screen.getByText("Waiting for Alex to start the match.")
  ).toBeInTheDocument();
});
test("empty team disables start and explains readiness", () => {
  room.teams = { "1": ["a", "b"], "2": [] };
  show();
  expect(screen.getByRole("button", { name: /Start match/ })).toBeDisabled();
  expect(screen.getByText("Every team needs a player.")).toBeInTheDocument();
});
test("describer sees the secret and explicit scoring destination", () => {
  Object.assign(room, {
    status: "playing",
    matchId: "match",
    describer: "a",
    yourWord: "banana peel",
    timeLeft: 30,
  });
  show();
  expect(screen.getByText("banana peel")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Correct · +1 to Team 1" })
  );
  expect(send).toHaveBeenCalledWith("correctWord");
  expect(
    screen.queryByRole("textbox", { name: "Your guess" })
  ).not.toBeInTheDocument();
});
test("participant can submit a typed guess", () => {
  Object.assign(room, {
    status: "playing",
    matchId: "match",
    describer: "a",
    yourWord: null,
    timeLeft: 30,
  });
  show("b");
  const input = screen.getByRole("textbox", { name: "Your guess" });
  fireEvent.change(input, { target: { value: "  banana peel  " } });
  const form = input.closest("form");
  if (!form) throw new Error("Guess form is missing");
  fireEvent.submit(form);
  expect(send).toHaveBeenCalledWith("guessWord", { guess: "banana peel" });
  expect(input).toHaveValue("");
  expect(
    screen.queryByRole("button", { name: /Correct/ })
  ).not.toBeInTheDocument();
});
test.each(["playing", "finished"] as const)(
  "late arrival is visibly waiting on %s with no game controls",
  (status) => {
    Object.assign(room, {
      status,
      matchId: "match",
      describer: status === "playing" ? "a" : null,
      winner: status === "finished" ? "draw" : null,
    });
    room.players.push("c");
    room.nicknames.c = "Casey";
    room.waitingPlayers = ["c"];
    show("c");
    expect(screen.getByText("Waiting for the next match")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Waiting for next match" })
    ).toBeInTheDocument();
    expect(screen.getByText("Casey")).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: "Your guess" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Join Team/ })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Play again/ })
    ).not.toBeInTheDocument();
  }
);
test("same-name connections are listed separately and identify you", () => {
  room.nicknames.b = "Alex";
  show("b");
  expect(screen.getByText("Alex · 1")).toBeInTheDocument();
  expect(screen.getByText("Alex · 2")).toBeInTheDocument();
  expect(screen.getByText("(you)")).toBeInTheDocument();
});
test("results show winner, scores and round breakdown, and host can play again", () => {
  Object.assign(room, {
    status: "finished",
    winner: "1",
    score: { "1": 2, "2": 1 },
  });
  room.history = [
    {
      round: 1,
      team: "1",
      outcome: "correct",
      points: 1,
      word: "banana peel",
      describerName: "Alex",
    },
    {
      round: 1,
      team: "2",
      outcome: "expired",
      points: 0,
      word: "arcade",
      describerName: "Blair",
    },
  ];
  show();
  expect(
    screen.getByRole("heading", { name: "Team 1 takes the win!" })
  ).toBeInTheDocument();
  expect(
    screen.getByLabelText("Final score: Team 1 2, Team 2 1")
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("table")).getByText("+1 · Correct")
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("table")).getByText("0 · Time expired")
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Play again/ }));
  expect(send).toHaveBeenCalledWith("resetGame");
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
});
test("cancellation explanation is visible in the lobby", () => {
  room.notice =
    "Match canceled: Blair left or disconnected. Everyone is back in the lobby.";
  show();
  expect(screen.getByRole("status")).toHaveTextContent(room.notice);
});
