export type Team = "1" | "2";
export interface TurnResult {
  round: number;
  team: Team;
  outcome: "correct" | "passed" | "expired";
  points: number;
  word: string;
  describerName: string;
}
export interface RoomState {
  roomName: string;
  players: string[];
  nicknames: Record<string, string>;
  hostId: string;
  teams: Record<Team, string[]>;
  waitingPlayers: string[];
  status: "waiting" | "playing" | "finished";
  phase?: "countdown" | "active" | "reveal";
  phaseSeconds?: number;
  settings: { rounds: number; turnSeconds: number };
  lobbyId: string;
  matchId: string | null;
  turnId: number;
  round: number;
  currentTeam: Team;
  describer: string | null;
  yourWord: string | null;
  timeLeft: number;
  score: Record<Team, number>;
  history: TurnResult[];
  guesses: { name: string; guess: string; round: number; team: Team }[];
  winner: Team | "draw" | null;
  notice: string;
}
export interface ActionResult {
  ok: boolean;
  error?: string;
}
