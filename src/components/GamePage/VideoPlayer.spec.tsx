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
const makeStream = (tracks: EventTarget[] = []) =>
  Object.assign(new EventTarget(), {
    getTracks: () => tracks,
  }) as unknown as MediaStream;
const stream = makeStream();
let play: jest.SpyInstance;
beforeEach(() => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  play = jest
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockResolvedValue(undefined);
});
afterEach(() => {
  play.mockRestore();
});

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
  rerender(<VideoPlayer stream={makeStream()} muted={false} label="Friend" />);
  await act(async () => reject(new Error("old")));
  expect((screen.getByLabelText("Friend") as HTMLVideoElement).muted).toBe(
    false
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

const visibility = async (state: string) => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
};

test("tab switches resume a paused video on the same stream without reopening devices", async () => {
  render(<VideoPlayer stream={stream} label="Friend" />);
  await act(async () => undefined);
  const video = screen.getByLabelText("Friend") as HTMLVideoElement;
  const assignments = jest.fn();
  Object.defineProperty(video, "srcObject", {
    get: () => stream,
    set: assignments,
    configurable: true,
  });
  await visibility("hidden");
  fireEvent.pause(video);
  expect(play).toHaveBeenCalledTimes(1);
  await visibility("visible");
  expect(play).toHaveBeenCalledTimes(2);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(play).toHaveBeenCalledTimes(3);
  expect(assignments).not.toHaveBeenCalled();
});

test("sound toggles preserve the source instead of clearing and reattaching it", async () => {
  const { rerender } = render(<VideoPlayer stream={stream} label="Friend" />);
  await act(async () => undefined);
  const video = screen.getByLabelText("Friend") as HTMLVideoElement;
  const assignments = jest.fn();
  Object.defineProperty(video, "srcObject", {
    get: () => stream,
    set: assignments,
    configurable: true,
  });
  rerender(<VideoPlayer stream={stream} muted={false} label="Friend" />);
  await act(async () => undefined);
  expect(video.muted).toBe(false);
  expect(assignments).not.toHaveBeenCalled();
});

test("a rejected background play does not override successful playback after focus", async () => {
  let reject!: (error: Error) => void;
  play.mockReturnValueOnce(
    new Promise((_resolve, fail) => {
      reject = fail;
    })
  );
  render(<VideoPlayer stream={stream} muted={false} label="Friend" />);
  await visibility("hidden");
  await visibility("visible");
  await act(async () => reject(new DOMException("old", "NotAllowedError")));
  expect((screen.getByLabelText("Friend") as HTMLVideoElement).muted).toBe(
    false
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("repeated browser pauses offer Resume video instead of an unbounded retry loop", async () => {
  render(<VideoPlayer stream={stream} label="Friend" />);
  await act(async () => undefined);
  const video = screen.getByLabelText("Friend");
  await act(async () => {
    fireEvent.pause(video);
  });
  await act(async () => {
    fireEvent.pause(video);
  });
  expect(play).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole("button", { name: "Resume video" }));
  await waitFor(() =>
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  );
  expect(play).toHaveBeenCalledTimes(3);
});

test("restoring a browser-detached source reattaches it, and unmount removes resume listeners", async () => {
  const { unmount } = render(<VideoPlayer stream={stream} label="Friend" />);
  await act(async () => undefined);
  const video = screen.getByLabelText("Friend") as HTMLVideoElement;
  video.srcObject = null;
  await act(async () => {
    window.dispatchEvent(new Event("pageshow"));
  });
  expect(video.srcObject).toBe(stream);
  unmount();
  play.mockClear();
  await visibility("visible");
  window.dispatchEvent(new Event("focus"));
  expect(play).not.toHaveBeenCalled();
  expect(video.srcObject).toBeNull();
});

test("a track that resumes after tab activation retries playback and removes its listener on leave", async () => {
  const track = new EventTarget();
  const { unmount } = render(<VideoPlayer stream={makeStream([track])} />);
  await act(async () => undefined);
  await act(async () => {
    track.dispatchEvent(new Event("unmute"));
  });
  expect(play).toHaveBeenCalledTimes(2);
  unmount();
  track.dispatchEvent(new Event("unmute"));
  expect(play).toHaveBeenCalledTimes(2);
});
