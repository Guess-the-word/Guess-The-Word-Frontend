import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { VideoChat } from "./VideoChat";
import { RoomMedia } from "./roomMedia";
import { useLocalMedia } from "./useLocalMedia";

jest.mock("../../services/socket", () => ({ socket: { id: "a" } }));
jest.mock("./useLocalMedia");
jest.mock("./roomMedia", () => ({
  RoomMedia: jest.fn().mockImplementation(() => ({
    setPlayers: jest.fn(),
    setStream: jest.fn(),
    dispose: jest.fn(),
    reconnect: jest.fn(),
  })),
}));
jest.mock("./VideoPlayer", () => ({
  VideoPlayer: ({ label }: { label: string }) => <video aria-label={label} />,
}));
const local = useLocalMedia as jest.MockedFunction<typeof useLocalMedia>;
const props = {
  roomName: "testroom",
  players: ["a", "b"],
  nicknames: { a: "Alex", b: "Blair" },
  describer: "a",
};
beforeEach(() => {
  (RoomMedia as jest.Mock).mockImplementation(() => ({
    setPlayers: jest.fn(),
    setStream: jest.fn(),
    dispose: jest.fn(),
    reconnect: jest.fn(),
  }));
  local.mockReturnValue({
    stream: null,
    cameraOn: false,
    micOn: false,
    busy: { video: false, audio: false },
    paused: { video: false, audio: false },
    errors: { video: "", audio: "" },
    toggle: jest.fn(),
    cancel: jest.fn(),
    resume: jest.fn(),
  });
});
test("expanding, changing sound and changing describer preserve video elements", () => {
  const { rerender } = render(<VideoChat {...props} />);
  const video = screen.getByLabelText("Blair's video");
  fireEvent.click(
    screen.getByRole("button", { name: "Enlarge Blair’s video" })
  );
  expect(
    screen.getByRole("button", { name: "Shrink Blair’s video" })
  ).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(screen.getByRole("button", { name: "Turn room sound on" }));
  rerender(<VideoChat {...props} describer="b" />);
  expect(screen.getByLabelText("Blair's video")).toBe(video);
  expect(video.closest(".videoSlot")).toHaveClass(
    "is-expanded",
    "is-describing"
  );
  fireEvent.click(screen.getByRole("button", { name: "Shrink Blair’s video" }));
  expect(screen.getByLabelText("Blair's video")).toBe(video);
});
test("a departing expanded player does not leave the rail expanded", () => {
  const { rerender } = render(<VideoChat {...props} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Enlarge Blair’s video" })
  );
  rerender(<VideoChat {...props} players={["a"]} />);
  expect(
    screen.getByLabelText("Your camera").closest(".videoGrid")
  ).not.toHaveClass("has-expanded");
});
