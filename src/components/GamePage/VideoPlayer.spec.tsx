import React from "react";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { VideoPlayer } from "./VideoPlayer";
const stream = {} as MediaStream;
let play: jest.SpyInstance;
beforeEach(() => {
  play = jest
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
});
afterEach(() => play.mockRestore());

test("muted video starts without a camera permission request", async () => {
  const { unmount } = render(<VideoPlayer stream={stream} label="Friend" />);
  const video = screen.getByLabelText("Friend") as HTMLVideoElement;
  expect(video.srcObject).toBe(stream);
  expect(video.muted).toBe(true);
  expect(play).toHaveBeenCalledTimes(1);
  unmount();
  expect(video.srcObject).toBeNull();
});

test("blocked sound falls back to a muted picture and offers an explicit play button", async () => {
  play.mockRejectedValueOnce(
    new DOMException("Autoplay blocked", "NotAllowedError")
  );
  render(<VideoPlayer stream={stream} muted={false} label="Friend" />);
  const button = await screen.findByRole("button", { name: "Play sound" });
  const video = screen.getByLabelText("Friend") as HTMLVideoElement;
  expect(video.muted).toBe(true);
  expect(play).toHaveBeenCalledTimes(2);
  fireEvent.click(button);
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Play sound" })
    ).not.toBeInTheDocument()
  );
  expect(video.muted).toBe(false);
});

test("a delayed playback failure from an old stream cannot mute the new stream", async () => {
  let reject!: (error: Error) => void;
  play.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  const { rerender } = render(
    <VideoPlayer stream={stream} muted={false} label="Friend" />
  );
  rerender(
    <VideoPlayer stream={{} as MediaStream} muted={false} label="Friend" />
  );
  await act(async () => reject(new Error("old")));
  expect((screen.getByLabelText("Friend") as HTMLVideoElement).muted).toBe(
    false
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
