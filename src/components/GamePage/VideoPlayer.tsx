import React, { useRef, useEffect } from "react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, muted }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      muted={muted}
      autoPlay
      playsInline
      className={stream ? "video-element has-stream" : "video-element"}
    />
  );
};
