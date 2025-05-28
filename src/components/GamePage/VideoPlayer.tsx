import React, { useRef, useEffect } from "react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ stream, muted }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      muted={muted}
      autoPlay
      playsInline
      style={{ width: "100%", borderRadius: "8px", backgroundColor: "#000" }}
    />
  );
};
