import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  SkipForward,
  RotateCcw,
  RotateCw,
  Gauge,
  Tv,
} from "lucide-react";
import { formatTime } from "../../lib/formatTime";

interface PlayerControlsBarProps {
  currentTime: number;
  duration: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  showSpeedMenu: boolean;
  setShowSpeedMenu: (v: boolean) => void;
  isFullscreen: boolean;
  pipSupported: boolean;
  hasNextEpisode: boolean;
  handleSeek: any;
  handleVolumeChange: any;
  togglePlay: () => void;
  skipBackward: () => void;
  skipForward: () => void;
  toggleMute: () => void;
  handleSpeedChange: (rate: number) => void;
  togglePip: () => void;
  toggleFullscreen: () => void;
  onPlayNext: () => void;
}

export default function PlayerControlsBar({
  currentTime,
  duration,
  playing,
  volume,
  muted,
  playbackRate,
  showSpeedMenu,
  setShowSpeedMenu,
  isFullscreen,
  pipSupported,
  hasNextEpisode,
  handleSeek,
  handleVolumeChange,
  togglePlay,
  skipBackward,
  skipForward,
  toggleMute,
  handleSpeedChange,
  togglePip,
  toggleFullscreen,
  onPlayNext,
}: PlayerControlsBarProps) {
  const VolumeIcon = muted || volume === 0 ? VolumeX : Volume2;

  return (
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
  );
}
