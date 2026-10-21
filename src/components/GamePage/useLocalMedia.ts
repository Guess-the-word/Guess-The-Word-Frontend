import { useEffect, useRef, useState } from "react";

type Kind = "video" | "audio";
const label = (kind: Kind) => (kind === "video" ? "Camera" : "Microphone");
export function mediaError(error: unknown, kind: Kind): string {
  const name = error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `${label(
        kind
      )} access was blocked. Allow it in your browser's site settings and your device's privacy settings, then try again.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `No available ${label(
        kind
      ).toLowerCase()} was found. Connect a device, then try again.`;
    case "NotReadableError":
    case "AbortError":
      return `${label(
        kind
      )} could not start. Close other apps or tabs using it, check your device settings, then try again.`;
    default:
      return `${label(
        kind
      )} could not start. Check your device and browser permissions, then try again.`;
  }
}

export function useLocalMedia() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState({ video: false, audio: false });
  const [errors, setErrors] = useState({ video: "", audio: "" });
  const tracks = useRef<Partial<Record<Kind, MediaStreamTrack>>>({});
  const requests = useRef({ video: 0, audio: 0 });
  const pending = useRef({ video: false, audio: false });
  const mounted = useRef(false);
  const update = () => {
    const live = Object.values(tracks.current).filter(
      (track): track is MediaStreamTrack => !!track
    );
    setStream(live.length ? new MediaStream(live) : null);
  };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requests.current.video++;
      requests.current.audio++;
      Object.values(tracks.current).forEach((track) => track?.stop());
      tracks.current = {};
    };
  }, []);

  const toggle = async (kind: Kind) => {
    if (pending.current[kind]) return;
    const active = tracks.current[kind];
    setErrors((previous) => ({ ...previous, [kind]: "" }));
    if (active) {
      delete tracks.current[kind];
      active.stop();
      update();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrors((previous) => ({
        ...previous,
        [kind]:
          window.isSecureContext === false
            ? "Camera and microphone require HTTPS or localhost. Open a secure version of this site."
            : "Camera and microphone are unavailable in this browser. Try an up-to-date browser.",
      }));
      return;
    }
    const requestId = ++requests.current[kind];
    pending.current[kind] = true;
    setBusy((previous) => ({ ...previous, [kind]: true }));
    try {
      // Permission or device failure for one input must not block the other.
      const acquired = await navigator.mediaDevices.getUserMedia({
        video: kind === "video",
        audio: kind === "audio",
      });
      if (!mounted.current || requestId !== requests.current[kind]) {
        acquired.getTracks().forEach((track) => track.stop());
        return;
      }
      const track = acquired.getTracks().find((item) => item.kind === kind);
      acquired
        .getTracks()
        .filter((item) => item !== track)
        .forEach((item) => item.stop());
      if (!track || track.readyState === "ended")
        throw new Error("No live media track");
      tracks.current[kind] = track;
      track.addEventListener(
        "ended",
        () => {
          if (!mounted.current || tracks.current[kind] !== track) return;
          delete tracks.current[kind];
          setErrors((previous) => ({
            ...previous,
            [kind]: `${label(
              kind
            )} disconnected. Check the device and turn it on again.`,
          }));
          update();
        },
        { once: true }
      );
      update();
    } catch (error) {
      if (mounted.current && requestId === requests.current[kind])
        setErrors((previous) => ({
          ...previous,
          [kind]: mediaError(error, kind),
        }));
    } finally {
      if (mounted.current && requestId === requests.current[kind]) {
        pending.current[kind] = false;
        setBusy((previous) => ({ ...previous, [kind]: false }));
      }
    }
  };
  const cancel = (kind: Kind) => {
    requests.current[kind]++;
    pending.current[kind] = false;
    setBusy((previous) => ({ ...previous, [kind]: false }));
  };
  return {
    stream,
    busy,
    errors,
    toggle,
    cancel,
    cameraOn: !!tracks.current.video,
    micOn: !!tracks.current.audio,
  };
}
