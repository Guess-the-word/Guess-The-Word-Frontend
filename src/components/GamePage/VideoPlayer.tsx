import React, { useRef, useEffect, useState } from "react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  label?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  stream,
  muted = true,
  label = "Player video",
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const retryRef = useRef<() => void>(() => undefined);
  const [blocked, setBlocked] = useState<"video" | "sound" | null>(null);

  // Sound toggles and focus changes must never detach a working stream.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    let attemptId = 0;
    let pending = false;
    let pauseRetried = false;
    setBlocked(null);
    video.muted = muted;

    const play = async () => {
      if (!active || !stream || document.visibilityState === "hidden") return;
      const request = ++attemptId;
      const current = () =>
        active &&
        request === attemptId &&
        document.visibilityState !== "hidden";
      pending = true;
      // Some embedded browsers detach media when their tab is suspended.
      if (video.srcObject !== stream) video.srcObject = stream;
      video.muted = muted;
      try {
        await video.play();
        if (current()) setBlocked(null);
      } catch (error) {
        if (!current()) return;
        if (
          !muted &&
          error instanceof Error &&
          error.name === "NotAllowedError"
        ) {
          // Sound permission must not prevent the silent picture from playing.
          video.muted = true;
          try {
            await video.play();
            if (current()) setBlocked("sound");
          } catch {
            if (current()) setBlocked("video");
          }
        } else {
          setBlocked("video");
        }
      } finally {
        if (request === attemptId) pending = false;
      }
    };
    const resume = () => {
      pauseRetried = false;
      void play();
    };
    const visibilityChanged = () => {
      if (document.visibilityState === "hidden") {
        attemptId++; // Ignore a delayed rejection from the backgrounded tab.
        pending = false;
      } else resume();
    };
    const paused = () => {
      if (
        !active ||
        !stream ||
        !video.paused ||
        pending ||
        document.visibilityState === "hidden"
      )
        return;
      // One retry per activation avoids fighting a browser that keeps pausing.
      if (!pauseRetried) {
        pauseRetried = true;
        void play();
      } else setBlocked("video");
    };
    const watchedTracks = new Set<MediaStreamTrack>();
    const watchTrack = (track: MediaStreamTrack) => {
      if (watchedTracks.has(track)) return;
      watchedTracks.add(track);
      track.addEventListener("unmute", resume);
    };
    const addedTrack = (event: MediaStreamTrackEvent) =>
      watchTrack(event.track);
    stream?.getTracks().forEach(watchTrack);
    stream?.addEventListener("addtrack", addedTrack);
    retryRef.current = resume;
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    video.addEventListener("pause", paused);
    void play();
    return () => {
      active = false;
      stream?.removeEventListener("addtrack", addedTrack);
      watchedTracks.forEach((track) =>
        track.removeEventListener("unmute", resume)
      );
      attemptId++;
      retryRef.current = () => undefined;
      document.removeEventListener("visibilitychange", visibilityChanged);
      window.removeEventListener("focus", resume);
      window.removeEventListener("pageshow", resume);
      video.removeEventListener("pause", paused);
    };
  }, [stream, muted]);

  return (
    <>
      <video
        ref={videoRef}
        aria-label={label}
        muted={muted}
        autoPlay
        playsInline
        className={stream ? "video-element has-stream" : "video-element"}
      />
      {stream && blocked && (
        <button
          className="video-play-button"
          onClick={() => retryRef.current()}
        >
          {blocked === "sound" ? "Play sound" : "Resume video"}
        </button>
      )}
    </>
  );
};
