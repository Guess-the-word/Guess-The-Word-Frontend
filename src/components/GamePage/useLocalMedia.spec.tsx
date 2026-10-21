import { act, renderHook } from "@testing-library/react";
import { useLocalMedia } from "./useLocalMedia";

class FakeTrack extends EventTarget {
  readyState = "live";
  stop = jest.fn(() => {
    this.readyState = "ended";
  });
  constructor(public kind: string) {
    super();
  }
}
class FakeStream {
  constructor(private tracks: FakeTrack[]) {}
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === "video");
  }
  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === "audio");
  }
}
let getUserMedia: jest.Mock;
beforeEach(() => {
  Object.defineProperty(global, "MediaStream", {
    configurable: true,
    value: FakeStream,
  });
  getUserMedia = jest.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
});

test("camera and microphone are off until explicitly requested and request independent permissions", async () => {
  const camera = new FakeTrack("video");
  const mic = new FakeTrack("audio");
  getUserMedia
    .mockResolvedValueOnce(new FakeStream([camera]))
    .mockResolvedValueOnce(new FakeStream([mic]));
  const { result, unmount } = renderHook(useLocalMedia);
  expect(getUserMedia).not.toHaveBeenCalled();
  await act(async () => {
    await result.current.toggle("video");
  });
  expect(getUserMedia).toHaveBeenNthCalledWith(1, {
    video: true,
    audio: false,
  });
  expect(result.current.cameraOn).toBe(true);
  expect(result.current.micOn).toBe(false);
  await act(async () => {
    await result.current.toggle("audio");
  });
  expect(getUserMedia).toHaveBeenNthCalledWith(2, {
    video: false,
    audio: true,
  });
  expect(result.current.stream?.getTracks()).toHaveLength(2);
  await act(async () => {
    await result.current.toggle("video");
  });
  expect(camera.stop).toHaveBeenCalledTimes(1);
  expect(mic.stop).not.toHaveBeenCalled();
  expect(result.current.micOn).toBe(true);
  unmount();
  expect(mic.stop).toHaveBeenCalledTimes(1);
});

test.each([
  ["NotAllowedError", "access was blocked"],
  ["NotFoundError", "No available camera"],
  ["NotReadableError", "Close other apps"],
])("explains %s without disabling the other input", async (name, message) => {
  getUserMedia
    .mockResolvedValueOnce(new FakeStream([new FakeTrack("audio")]))
    .mockRejectedValueOnce(Object.assign(new Error(), { name }));
  const { result } = renderHook(useLocalMedia);
  await act(async () => {
    await result.current.toggle("audio");
  });
  await act(async () => {
    await result.current.toggle("video");
  });
  expect(result.current.errors.video).toContain(message);
  expect(result.current.cameraOn).toBe(false);
  expect(result.current.micOn).toBe(true);
  expect(result.current.busy.video).toBe(false);
});

test("repeated clicks make one request and permission resolving after unmount releases the device", async () => {
  let resolve!: (stream: FakeStream) => void;
  getUserMedia.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const { result, unmount } = renderHook(useLocalMedia);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.toggle("video");
    void result.current.toggle("video");
  });
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  unmount();
  const track = new FakeTrack("video");
  await act(async () => {
    resolve(new FakeStream([track]));
    await pending;
  });
  expect(track.stop).toHaveBeenCalledTimes(1);
});

test("canceling a pending permission request ignores and stops its later result", async () => {
  let resolve!: (stream: FakeStream) => void;
  getUserMedia.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    })
  );
  const { result } = renderHook(useLocalMedia);
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.toggle("video");
  });
  act(() => result.current.cancel("video"));
  expect(result.current.busy.video).toBe(false);
  const track = new FakeTrack("video");
  await act(async () => {
    resolve(new FakeStream([track]));
    await pending;
  });
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(result.current.cameraOn).toBe(false);
});

test("device unplug updates the UI and lets the player retry", async () => {
  const track = new FakeTrack("video");
  getUserMedia.mockResolvedValue(new FakeStream([track]));
  const { result } = renderHook(useLocalMedia);
  await act(async () => {
    await result.current.toggle("video");
  });
  act(() => track.dispatchEvent(new Event("ended")));
  expect(result.current.cameraOn).toBe(false);
  expect(result.current.stream).toBeNull();
  expect(result.current.errors.video).toContain("disconnected");
});

test("explains missing secure context without throwing", async () => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: false,
  });
  const { result } = renderHook(useLocalMedia);
  await act(async () => {
    await result.current.toggle("video");
  });
  expect(result.current.errors.video).toContain("HTTPS or localhost");
});
