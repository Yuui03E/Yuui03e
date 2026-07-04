import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { convertFileSrc } from "@tauri-apps/api/core";

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
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
  }, [filePath]);

  // Handle controls visibility timer
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (playing) {
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
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    }
    resetControlsTimeout();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    const dur = videoRef.current.duration || 0;
    if (dur > 0 && curr / dur >= 0.85 && !syncTriggered) {
      setSyncTriggered(true);
      onWatched();
    }
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        if (videoRef.current) videoRef.current.currentTime += 10;
      } else if (e.key === "ArrowLeft") {
        if (videoRef.current) videoRef.current.currentTime -= 10;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [playing, onClose]);

  return (
    <div
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
            className="glass-strong absolute left-0 right-0 top-0 flex items-center justify-between p-4 px-8 border-b border-white/[0.05]"
          >
            <div>
              <span className="text-[10px] text-yuui-accent2 font-semibold uppercase tracking-wider block">Now Playing</span>
              <span className="text-sm font-semibold text-white">Episode {episodeNumber} · {title}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 px-4 py-2 text-xs font-semibold text-white/80 transition-colors"
            >
              Close Player (Esc)
            </button>
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
            className="glass-strong absolute bottom-0 left-0 right-0 p-6 px-8 border-t border-white/[0.05] space-y-4"
          >
            {/* Timeline Slider */}
            <div className="flex items-center gap-4">
              <span className="text-xs font-semibold text-yuui-muted font-mono">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full accent-yuui-accent h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10"
              />
              <span className="text-xs font-semibold text-yuui-muted font-mono">{formatTime(duration)}</span>
            </div>

            {/* Actions Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="rounded-xl bg-yuui-accent hover:bg-yuui-accent2 p-2.5 px-4 text-xs font-bold text-white shadow-glow transition-all"
                >
                  {playing ? "⏸ Pause" : "▶ Play"}
                </button>

                {/* Volume slider */}
                <div className="flex items-center gap-2.5">
                  <button onClick={toggleMute} className="text-lg hover:text-yuui-accent transition-colors">
                    {muted || volume === 0 ? "🔇" : "🔊"}
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

              {hasNextEpisode && (
                <button
                  onClick={onPlayNext}
                  className="rounded-xl bg-white/5 hover:bg-white/[0.1] px-4 py-2 text-xs font-semibold text-white/90 border border-white/[0.05] transition-colors"
                >
                  Skip to Next Episode ➔
                </button>
              )}
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
            className="absolute inset-0 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          >
            <div className="glass-strong p-8 rounded-3xl text-center max-w-sm border border-white/[0.08] bg-yuui-surface/60 space-y-6">
              <div className="text-4xl">🍿</div>
              <div>
                <h3 className="text-lg font-bold text-white">Episode Completed!</h3>
                <p className="mt-1.5 text-xs text-yuui-muted">Next episode starts in <span className="text-yuui-accent font-bold font-mono">{nextCountdown}s</span>...</p>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={onPlayNext}
                  className="w-full rounded-xl bg-gradient-to-r from-yuui-accent to-yuui-accent2 py-2.5 text-xs font-semibold text-white shadow-glow hover:opacity-90 transition-all"
                >
                  Play Now
                </button>
                <button
                  onClick={() => setShowNextPrompt(false)}
                  className="w-full rounded-xl bg-white/5 hover:bg-white/[0.1] py-2 text-xs font-semibold text-white/70 transition-colors"
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
