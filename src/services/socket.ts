import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:4000";

// Use the instance type `Socket` instead of `typeof Socket`
export const socket: Socket = io(SOCKET_URL);

socket.on("connect", () => {
  console.log("Connected to server");
});

socket.on("connect_error", (error: Error) => {
  console.error("Socket connection error:", error);
});
