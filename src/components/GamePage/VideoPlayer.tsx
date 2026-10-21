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
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    video.srcObject = stream;
    video.muted = muted;
    setBlocked(false);
    if (stream) {
      void video.play().catch(() => {
        if (!active) return;
        setBlocked(true);
        // Keep the picture visible when the browser requires a click for audio.
        video.muted = true;
        void video.play().catch(() => undefined);
      });
    }
    return () => {
      active = false;
      video.srcObject = null;
    };
  }, [stream, muted]);

  const play = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    try {
      await video.play();
      setBlocked(false);
    } catch {
      setBlocked(true);
    }
  };
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
      {blocked && (
        <button className="video-play-button" onClick={play}>
          {muted ? "Play video" : "Play sound"}
        </button>
      )}
    </>
  );
};
