import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Check, Bookmark, Info } from "lucide-react";
import type { AiringEpisode } from "./types";

export default function AiringCardGrid({
  ep,
  inLibrary,
  cover,
  color,
  title,
  studioName,
  statusText,
  timeLeft,
  isFavorited,
  favCount,
  toastMsg,
  handleNavigate,
  handleSetStatus,
  handleToggleFavorite,
}: {
  ep: AiringEpisode;
  inLibrary: boolean;
  cover: string | null;
  color: string;
  title: string;
  studioName: string | undefined;
  statusText: string;
  timeLeft: number;
  isFavorited: boolean;
  favCount: number;
  toastMsg: string | null;
  handleNavigate: () => void;
  handleSetStatus: (status: string) => void;
  handleToggleFavorite: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [showTrackPicker, setShowTrackPicker] = useState(false);

  // Dynamic glow and border colors matching the cover color variable
  const dynamicStyles = {
    borderColor: isHovered ? `${color}40` : "rgba(255,255,255,0.05)",
    boxShadow: isHovered
      ? `0 0 25px ${color}15, inset 0 0 12px ${color}08`
      : "none",
  };

  // Next-Gen Vertical Movie Poster Grid Card style
  return (
    <motion.div
      layout
      whileHover={{ y: -4, scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={dynamicStyles}
      className="glass group relative flex flex-col gap-3 rounded-2xl border bg-yuui-surface/30 p-3.5 text-left w-full justify-between transition-all duration-300 overflow-hidden"
    >
      {/* Toast Alert overlay */}
      {toastMsg && (
        <div className="absolute top-2 left-2 right-2 bg-black/90 border border-white/10 text-white rounded-xl py-1.5 px-3 text-[10px] font-bold text-center z-50 shadow-lg backdrop-blur">
          {toastMsg}
        </div>
      )}

      {/* Portrait Poster Cover */}
      <div
        onClick={handleNavigate}
        className="w-full aspect-[2/3] rounded-xl overflow-hidden relative bg-white/5 border border-white/5 shrink-0 cursor-pointer shadow-md"
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-4xl" style={{ background: `linear-gradient(135deg, ${color}33, #0f0f16)` }}>🌸</div>
        )}

        {/* Floating badges on poster */}
        {inLibrary && (
          <div className="absolute top-2 left-2 h-6 w-6 rounded-full flex items-center justify-center text-white border border-emerald-500/20 bg-emerald-500/80 backdrop-blur-[2px] shadow-md">
            <Check className="h-3 w-3 text-white" />
          </div>
        )}

        {ep.media.averageScore && (
          <div className="absolute top-2 right-2 rounded-lg bg-black/60 border border-white/10 px-1.5 py-0.5 text-[8px] font-bold text-yuui-accent3 backdrop-blur-[2px]">
            ★ {ep.media.averageScore}%
          </div>
        )}


      </div>

      {/* Info Column */}
      <div className="flex-1 flex flex-col justify-between gap-2 min-w-0">
        <div className="space-y-1.5">
          {/* Airing countdown status badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.05] px-2 py-0.5 text-[9px] font-bold">
            <span className={`h-1.5 w-1.5 rounded-full ${timeLeft > 0 ? "bg-yuui-accent3 animate-pulseGlow" : "bg-white/40"}`} />
            <span className={timeLeft > 0 ? "text-yuui-accent3" : "text-white/60"}>
              {statusText}
            </span>
          </div>

          {/* Title */}
          <h3
            onClick={handleNavigate}
            className="text-xs font-bold text-white hover:text-white cursor-pointer leading-snug line-clamp-2 transition-colors"
            title={title}
            style={{ color: isHovered ? color : "#ffffff" }}
          >
            {title}
          </h3>

          {/* Meta row */}
          <div className="flex items-center justify-between text-[9px] font-medium text-yuui-muted">
            <span className="truncate max-w-[70%]">{studioName || "Unknown Studio"}</span>
            <span className="shrink-0">Ep {ep.episode}</span>
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-white/[0.04] pt-2.5 flex items-center justify-between gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={handleNavigate}
              className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.1] active:scale-[0.96] text-white/90 hover:text-white transition-all cursor-pointer"
              title="Details"
            >
              <Info className="h-3 w-3" />
            </button>

            <div className="relative">
              <button
                onClick={() => setShowTrackPicker(!showTrackPicker)}
                className={`flex h-7 w-7 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  showTrackPicker
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "bg-white/5 border-white/5 text-white/60 hover:bg-white/[0.1]"
                }`}
                title="Track Status"
              >
                <Bookmark className="h-3 w-3" />
              </button>

              {showTrackPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTrackPicker(false)} />
                  <div className="absolute bottom-full mb-2 left-0 bg-black rounded-2xl p-1 z-50 shadow-lg border border-white/15 flex flex-col gap-0.5 min-w-[100px]">
                    {["Watching", "Planning", "Completed", "Paused", "Dropped"].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleSetStatus(status)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-bold text-left text-white/85 hover:bg-white/10 transition-all cursor-pointer"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={handleToggleFavorite}
            className={`flex h-7 items-center gap-1 px-2 rounded-xl border transition-all cursor-pointer ${
              isFavorited
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "bg-white/5 border-white/5 text-white/60 hover:bg-white/[0.1]"
            }`}
          >
            <Heart className={`h-3 w-3 ${isFavorited ? "fill-red-500" : ""}`} />
            <span className="text-[9px] font-bold font-mono">
              {favCount > 999 ? `${(favCount / 1000).toFixed(1)}k` : favCount}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
