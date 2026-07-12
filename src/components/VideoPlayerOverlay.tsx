import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import TitleBarControls from "./TitleBarControls";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  SkipForward,
  RotateCcw,
  RotateCw,
  Gauge,
  Tv
} from "lucide-react";
import {
  savePlaybackPosition,
  getPlaybackPosition,
  deletePlaybackPosition,
} from "../lib/api";

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

  const handleTopBarMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !(e.target as HTMLElement).closest("button")) {
      getCurrentWebviewWindow().startDragging();
    }
  };

  const handleTopBarDoubleClick = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("button")) {
      getCurrentWebviewWindow().toggleMaximize();
    }
  };
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [syncTriggered, setSyncTriggered] = useState(false);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [nextCountdown, setNextCountdown] = useState(5);

  const controlsTimeoutRef = useRef<number | null>(null);

  // Convert file path to Tauri URL
  const videoSrc = convertFileSrc(filePath);

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

  // Handle controls visibility timer
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      const isPaused = videoRef.current ? videoRef.current.paused : true;
      if (!isPaused) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [playing]);

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

  // Throttle playback position saves to avoid hammering SQLite on every
  // `timeupdate` event (which fires ~4×/second).
  const lastSaveRef = useRef(0);

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    const dur = videoRef.current.duration || 0;
    if (dur > 0 && curr > 0) {
      // Throttle: save at most once every 5 seconds
      const now = Date.now();
      if (now - lastSaveRef.current >= 5000) {
        lastSaveRef.current = now;
        savePlaybackPosition({
          file_path: filePath,
          series_key: null,
          episode: episodeNumber,
          title,
          position: curr,
          duration: dur,
        }).catch((err) =>
          console.error("Failed to save playback position:", err),
        );
      }
    }

    if (dur > 0 && curr / dur >= 0.85 && !syncTriggered) {
      setSyncTriggered(true);
      onWatched();
      // Remove the playback position entry since the episode is watched
      deletePlaybackPosition(filePath).catch((err) =>
        console.error("Failed to delete playback position:", err),
      );
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    setDuration(dur);

    // Restore saved position from SQLite
    getPlaybackPosition(filePath)
      .then((savedTime) => {
        if (savedTime !== null && savedTime > 0 && savedTime < dur - 10) {
          if (videoRef.current) {
            videoRef.current.currentTime = savedTime;
            setCurrentTime(savedTime);
          }
        }
      })
      .catch((err) => console.error("Failed to load playback position:", err));
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

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

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

  // Next episode countdown
  useEffect(() => {
    if (!showNextPrompt) return;
    const interval = setInterval(() => {
      setNextCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onPlayNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showNextPrompt, onPlayNext]);

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Keyboard shortcut controls
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        togglePlayRef.current();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "ArrowRight") {
        if (videoRef.current) videoRef.current.currentTime += 10;
      } else if (e.key === "ArrowLeft") {
        if (videoRef.current) videoRef.current.currentTime -= 10;
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMute();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (videoRef.current) {
          const nextVol = Math.min(1, videoRef.current.volume + 0.05);
          videoRef.current.volume = nextVol;
          setVolume(nextVol);
          setMuted(nextVol === 0);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (videoRef.current) {
          const nextVol = Math.max(0, videoRef.current.volume - 0.05);
          videoRef.current.volume = nextVol;
          setVolume(nextVol);
          setMuted(nextVol === 0);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const VolumeIcon = muted || volume === 0 ? VolumeX : Volume2;

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
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onMouseDown={handleTopBarMouseDown}
            onDoubleClick={handleTopBarDoubleClick}
            data-tauri-drag-region
            className="glass-strong absolute left-0 right-0 top-0 flex items-center justify-between pl-8 pr-2 py-2 border-b border-white/[0.05] z-30 select-none cursor-default"
          >
            <div className="flex-grow min-w-0 pr-4 pointer-events-none">
              <span className="text-[10px] text-yuui-accent2 font-semibold uppercase tracking-wider block">
                Now Playing
              </span>
              <span className="text-sm font-semibold text-white truncate block">
                Episode {episodeNumber} · {title}
              </span>
            </div>
            <div className="flex items-center gap-3 no-drag pointer-events-auto">
              <button
                onClick={onClose}
                title="Close Player (Esc)"
                className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-400 hover:shadow-[0_0_12px_rgba(239,68,68,0.5)] px-4 py-2 text-xs font-semibold text-white/80 transition-all cursor-pointer active:scale-95"
              >
                <X className="h-3.5 w-3.5" />
                <span>Close Player (Esc)</span>
              </button>

              <div className="h-8 w-px bg-white/10" />

              <TitleBarControls />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls Bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="glass-strong absolute bottom-0 left-0 right-0 p-6 px-8 border-t border-white/[0.05] space-y-4 z-30"
          >
            {/* Timeline Slider */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-yuui-muted font-mono w-12 text-left">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex-grow flex items-center group">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-yuui-accent h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10 group-hover:h-2 transition-all"
                />
              </div>
              <span className="text-xs font-semibold text-yuui-muted font-mono w-12 text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center justify-between">
              {/* Playback Controls */}
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  title={playing ? "Pause (Space)" : "Play (Space)"}
                  className="rounded-xl bg-yuui-accent hover:bg-yuui-accent2 p-2.5 px-3 text-xs font-bold text-white shadow-glow transition-all cursor-pointer active:scale-95 flex items-center justify-center"
                >
                  {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>

                {/* Skip buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={skipBackward}
                    title="Skip backward 10s (←)"
                    className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={skipForward}
                    title="Skip forward 10s (→)"
                    className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <RotateCw className="h-4 w-4" />
                  </button>
                </div>

                {/* Volume controls */}
                <div className="flex items-center gap-2.5 pl-2 border-l border-white/10">
                  <button
                    onClick={toggleMute}
                    className="text-white/70 hover:text-white transition-colors cursor-pointer"
                  >
                    <VolumeIcon className="h-4 w-4" />
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20 accent-yuui-accent h-1 rounded-lg appearance-none cursor-pointer bg-white/10"
                  />
                </div>
              </div>

              {/* Extras and Screen Controls */}
              <div className="flex items-center gap-4">
                {/* Speed Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/[0.06] hover:bg-white/10 px-3 py-2 text-xs font-semibold text-white/80 transition-colors cursor-pointer"
                  >
                    <Gauge className="h-3.5 w-3.5" />
                    <span>{playbackRate === 1 ? "Normal" : `${playbackRate}x`}</span>
                  </button>
                  {showSpeedMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSpeedMenu(false)} />
                      <div className="absolute bottom-full mb-2 right-0 bg-black/95 border border-white/10 rounded-xl p-1 z-50 shadow-lg min-w-[100px] flex flex-col gap-0.5">
                        {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                          <button
                            key={rate}
                            onClick={() => handleSpeedChange(rate)}
                            className={`px-3 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-all ${
                              playbackRate === rate
                                ? "bg-yuui-accent text-white font-bold"
                                : "text-white/70 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            {rate === 1.0 ? "Normal" : `${rate}x`}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* PiP Button */}
                {pipSupported && (
                  <button
                    onClick={togglePip}
                    title="Picture in Picture"
                    className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Tv className="h-4 w-4" />
                  </button>
                )}

                {/* Fullscreen Toggle */}
                <button
                  onClick={toggleFullscreen}
                  title="Toggle Fullscreen (F)"
                  className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>

                {/* Next Episode skip button */}
                {hasNextEpisode && (
                  <button
                    onClick={onPlayNext}
                    className="flex items-center gap-1 rounded-xl bg-white/5 border border-white/[0.06] hover:bg-white/[0.1] px-4 py-2 text-xs font-semibold text-white/90 transition-all cursor-pointer active:scale-95"
                  >
                    <span>Next Ep</span>
                    <SkipForward className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next Episode Countdown Prompt overlay */}
      <AnimatePresence>
        {showNextPrompt && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm z-40"
          >
            <div className="glass-strong p-8 rounded-3xl text-center max-w-sm border border-white/[0.08] bg-yuui-surface/60 space-y-6">
              <div className="text-4xl">🍿</div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Episode Completed!
                </h3>
                <p className="mt-1.5 text-xs text-yuui-muted">
                  Next episode starts in{" "}
                  <span className="text-yuui-accent font-bold font-mono">
                    {nextCountdown}s
                  </span>
                  ...
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={onPlayNext}
                  className="w-full rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 py-2.5 text-xs font-semibold text-white shadow-glow hover:opacity-90 transition-all cursor-pointer"
                >
                  Play Now
                </button>
                <button
                  onClick={() => setShowNextPrompt(false)}
                  className="w-full rounded-xl bg-white/5 hover:bg-white/[0.1] py-2 text-xs font-semibold text-white/70 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
