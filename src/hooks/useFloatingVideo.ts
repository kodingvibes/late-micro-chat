import { useCallback, useEffect, useRef, useState } from "react";
import type { ChannelState } from "@/lib/chat/domain/types";

export function useFloatingVideo() {
  const [floatingVideo, setFloatingVideo] = useState<string | null>(null);
  const floatingVideoRef = useRef<string | null>(null);
  useEffect(() => {
    floatingVideoRef.current = floatingVideo;
  }, [floatingVideo]);

  const floatingSourceChannelRef = useRef<number | null>(null);
  const playingVideoRef = useRef<string | null>(null);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const floatingContainerRef = useRef<HTMLDivElement>(null);
  const restoreTimeRef = useRef<{ attachmentId: string; time: number } | null>(null);

  const closeFloatingVideo = useCallback(() => {
    const container = floatingContainerRef.current;
    if (container) {
      const video = container.querySelector("video");
      if (video) {
        restoreTimeRef.current = {
          attachmentId: floatingVideoRef.current || "",
          time: video.currentTime,
        };
        video.pause();
        video.remove();
      }
    }
    setFloatingVideo(null);
    playingVideoRef.current = null;
    floatingSourceChannelRef.current = null;
  }, []);

  const handleVideoRef = useCallback(
    (attachmentId: string, el: HTMLVideoElement | null) => {
      if (el) {
        videoElementsRef.current.set(attachmentId, el);
        if (
          restoreTimeRef.current &&
          restoreTimeRef.current.attachmentId === attachmentId
        ) {
          el.currentTime = restoreTimeRef.current.time;
          restoreTimeRef.current = null;
        }
      }
    },
    []
  );

  const handleVideoPlay = useCallback((attachmentId: string) => {
    playingVideoRef.current = attachmentId;
  }, []);

  const handleVideoFloat = useCallback((attachmentId: string) => {
    const video = videoElementsRef.current.get(attachmentId);
    if (video && floatingContainerRef.current) {
      floatingContainerRef.current.appendChild(video);
    }
    setFloatingVideo(attachmentId);
  }, []);

  const maybeFloatOnChannelSwitch = useCallback(
    (
      currentChannel: number | null,
      channels: Map<number, ChannelState>,
      handleChannelSelect: (id: number) => void
    ) => {
      const id = currentChannel;
      if (id === null) return;
      if (
        floatingVideoRef.current &&
        id === floatingSourceChannelRef.current
      ) {
        closeFloatingVideo();
      }
      const playing = playingVideoRef.current;
      if (playing && !floatingVideoRef.current) {
        const video = videoElementsRef.current.get(playing);
        if (video && floatingContainerRef.current) {
          floatingContainerRef.current.appendChild(video);
        }
        floatingSourceChannelRef.current = id;
        setFloatingVideo(playing);
      }
      handleChannelSelect(id);
    },
    [closeFloatingVideo]
  );

  return {
    floatingVideo,
    floatingContainerRef,
    videoElementsRef,
    playingVideoRef,
    closeFloatingVideo,
    handleVideoRef,
    handleVideoPlay,
    handleVideoFloat,
    maybeFloatOnChannelSwitch,
  };
}
