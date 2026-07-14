import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useControlsAutoHide } from "./player/hooks/useControlsAutoHide";
import { useNextEpisodeCountdown } from "./player/hooks/useNextEpisodeCountdown";
import { usePlaybackPersistence } from "./player/hooks/usePlaybackPersistence";
import { useVideoKeyboardShortcuts } from "./player/hooks/useVideoKeyboardShortcuts";
import PlayerTopBar from "./player/PlayerTopBar";
import PlayerControlsBar from "./player/PlayerControlsBar";
import NextEpisodePrompt from "./player/NextEpisodePrompt";

interface VideoPlayerOverlayProps {
  filePath: string;
  episodeNumber: number;
  title: string;
  onClose: () => void;
  onWatched: () => void;
  hasNextEpisode: boolean;
  onPlayNext: () => void;
}

export default function VideoPlayerOverlay({
  filePath,
  episodeNumber,
  title,
  onClose,
  onWatched,
  hasNextEpisode,
  onPlayNext,
}: VideoPlayerOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [syncTriggered, setSyncTriggered] = useState(false);
  const [showNextPrompt, setShowNextPrompt] = useState(false);

  // Convert file path to Tauri URL
  const videoSrc = convertFileSrc(filePath);

  const { showControls, resetControlsTimeout } = useControlsAutoHide(
    videoRef,
    playing,
  );
  const { nextCountdown, setNextCountdown } = useNextEpisodeCountdown(
    showNextPrompt,
    onPlayNext,
  );
  const { handleTimeUpdate, handleLoadedMetadata } = usePlaybackPersistence({
    filePath,
    episodeNumber,
    title,
    videoRef,
    onWatched,
    setCurrentTime,
    setDuration,
    syncTriggered,
    setSyncTriggered,
  });

  useEffect(() => {
    // Reset sync state when video source changes
    setSyncTriggered(false);
    setShowNextPrompt(false);
    setNextCountdown(5);
    setPlaying(false);
    setPlaybackRate(1);
    if (videoRef.current) {
      videoRef.current.playbackRate = 1;
    }
  }, [filePath]);

  useEffect(() => {
    if (videoRef.current) {
      setPipSupported(
        !!document.pictureInPictureEnabled &&
        typeof videoRef.current.requestPictureInPicture === "function"
      );
    }
  }, [filePath]);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      setPlaying(false);
    } else {
      video.play().catch(() => {});
      setPlaying(true);
    }
    resetControlsTimeout();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const seekTime = Number(e.target.value);
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    resetControlsTimeout();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const vol = Number(e.target.value);
    videoRef.current.volume = vol;
    setVolume(vol);
    setMuted(vol === 0);
    resetControlsTimeout();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !muted;
    videoRef.current.muted = nextMute;
    setMuted(nextMute);
    resetControlsTimeout();
  };

  const skipBackward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
      resetControlsTimeout();
    }
  };

  const skipForward = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
      resetControlsTimeout();
    }
  };

  const handleSpeedChange = (rate: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
      setPlaybackRate(rate);
    }
    setShowSpeedMenu(false);
    resetControlsTimeout();
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
    resetControlsTimeout();
  };

  const togglePip = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.error("PiP error:", err);
    }
    resetControlsTimeout();
  };

  const handleEnded = () => {
    setPlaying(false);
    if (hasNextEpisode) {
      setShowNextPrompt(true);
    }
  };

  useVideoKeyboardShortcuts({
    togglePlay,
    onClose,
    toggleFullscreen,
    toggleMute,
    videoRef,
    setVolume,
    setMuted,
  });

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black select-none"
      onMouseMove={resetControlsTimeout}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoSrc}
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        className="h-full w-full object-contain cursor-pointer"
        autoPlay
      />

      {/* Top Controls Bar */}
      <AnimatePresence>
        {showControls && (
          <PlayerTopBar
            episodeNumber={episodeNumber}
            title={title}
            onClose={onClose}
          />
        )}
      </AnimatePresence>

      {/* Bottom Controls Bar */}
      <AnimatePresence>
        {showControls && (
          <PlayerControlsBar
            currentTime={currentTime}
            duration={duration}
            playing={playing}
            volume={volume}
            muted={muted}
            playbackRate={playbackRate}
            showSpeedMenu={showSpeedMenu}
            setShowSpeedMenu={setShowSpeedMenu}
            isFullscreen={isFullscreen}
            pipSupported={pipSupported}
            hasNextEpisode={hasNextEpisode}
            handleSeek={handleSeek}
            handleVolumeChange={handleVolumeChange}
            togglePlay={togglePlay}
            skipBackward={skipBackward}
            skipForward={skipForward}
            toggleMute={toggleMute}
            handleSpeedChange={handleSpeedChange}
            togglePip={togglePip}
            toggleFullscreen={toggleFullscreen}
            onPlayNext={onPlayNext}
          />
        )}
      </AnimatePresence>

      {/* Next Episode Countdown Prompt overlay */}
      <AnimatePresence>
        {showNextPrompt && (
          <NextEpisodePrompt
            nextCountdown={nextCountdown}
            onPlayNext={onPlayNext}
            onCancel={() => setShowNextPrompt(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
