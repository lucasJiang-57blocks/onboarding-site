"use client";

import { useState } from "react";

interface VideoProps {
  src?: string;
  youtubeId?: string;
  vimeoId?: string;
  title?: string;
  width?: string | number;
  height?: string | number;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  className?: string;
}

/**
 * Video component for MDX files
 * Supports:
 * - Direct video files (mp4, webm, etc.)
 * - YouTube embeds (via youtubeId)
 * - Vimeo embeds (via vimeoId)
 * - Custom iframe embeds (via src)
 */
export default function Video({
  src,
  youtubeId,
  vimeoId,
  title = "Video",
  width = "100%",
  height = "auto",
  autoplay = false,
  controls = true,
  loop = false,
  muted = false,
  className = "",
}: VideoProps) {
  const [isLoading, setIsLoading] = useState(true);

  // YouTube embed
  if (youtubeId) {
    const youtubeSrc = `https://www.youtube.com/embed/${youtubeId}?${
      autoplay ? "autoplay=1&" : ""
    }${muted ? "mute=1&" : ""}${controls ? "" : "controls=0&"}${loop ? "loop=1&playlist=" + youtubeId + "&" : ""}`;

    return (
      <div
        className={`my-8 w-full overflow-hidden rounded-lg ${className}`}
        style={{ aspectRatio: "16/9" }}
      >
        <iframe
          src={youtubeSrc}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    );
  }

  // Vimeo embed
  if (vimeoId) {
    const vimeoSrc = `https://player.vimeo.com/video/${vimeoId}?${
      autoplay ? "autoplay=1&" : ""
    }${muted ? "muted=1&" : ""}${controls ? "" : "controls=0&"}${loop ? "loop=1&" : ""}`;

    return (
      <div
        className={`my-8 w-full overflow-hidden rounded-lg ${className}`}
        style={{ aspectRatio: "16/9" }}
      >
        <iframe
          src={vimeoSrc}
          title={title}
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    );
  }

  // Direct video file or custom iframe
  if (src) {
    // Check if it's a video file extension
    const isVideoFile = /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i.test(src);

    if (isVideoFile) {
      return (
        <div className={`my-8 w-full ${className}`}>
          <video
            src={src}
            title={title}
            width={width}
            height={height}
            controls={controls}
            autoPlay={autoplay}
            loop={loop}
            muted={muted}
            className="w-full rounded-lg"
            onLoadedData={() => setIsLoading(false)}
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    // Custom iframe embed
    return (
      <div
        className={`my-8 w-full overflow-hidden rounded-lg ${className}`}
        style={{ aspectRatio: "16/9" }}
      >
        <iframe
          src={src}
          title={title}
          allowFullScreen
          className="h-full w-full"
          onLoad={() => setIsLoading(false)}
        />
      </div>
    );
  }

  return null;
}

