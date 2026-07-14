import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { countdown } from "../../lib/format";
import type { AiringEpisode } from "./types";

export default function AiringCardBoard({
  ep,
  inLibrary,
  posterWidth,
  cover,
  color,
  title,
  studioName,
  formatStr,
  timeLeft,
  timeStr,
  handleNavigate,
}: {
  ep: AiringEpisode;
  inLibrary: boolean;
  posterWidth: number;
  cover: string | null;
  color: string;
  title: string;
  studioName: string | undefined;
  formatStr: string;
  timeLeft: number;
  timeStr: string;
  handleNavigate: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  // Dynamic glow and border colors matching the cover color variable
  const dynamicStyles = {
    borderColor: isHovered ? `${color}40` : "rgba(255,255,255,0.05)",
    boxShadow: isHovered
      ? `0 0 25px ${color}15, inset 0 0 12px ${color}08`
      : "none",
  };

  // Compact View (Kanban Board Columns)
  const thumbWidth = Math.round(posterWidth * 0.35); // Scales compact thumbnails dynamically
  return (
    <motion.div
      layout
      whileHover={{ y: -2, scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleNavigate}
      style={dynamicStyles}
      className="glass group relative flex gap-3 rounded-xl border p-2 text-left w-full cursor-pointer transition-all duration-300"
    >
      {/* Cover Thumbnail (Tall aspect ratio) */}
      <div
        style={{ width: thumbWidth, height: Math.round(thumbWidth * 1.5) }}
        className="shrink-0 rounded-lg overflow-hidden relative bg-white/5 border border-white/5"
      >
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm bg-yuui-accent/10">🌸</div>
        )}
        {inLibrary && (
          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center backdrop-blur-[1px]">
            <Check className="h-4 w-4 text-emerald-400 drop-shadow" />
          </div>
        )}
      </div>

      {/* Info Block */}
      <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        <div>
          <h4 className="text-xs font-bold text-white/90 leading-snug truncate group-hover:text-white transition-colors">
            {title}
          </h4>
          <div className="text-[9px] text-yuui-muted font-medium mt-0.5 truncate">
            Ep {ep.episode} {studioName ? `· ${studioName}` : ""}
          </div>
        </div>

        {/* Time & Format */}
        <div className="flex items-center justify-between gap-1 text-[9px] font-mono">
          <span className={timeLeft > 0 ? "font-semibold text-yuui-accent3" : "text-yuui-muted"}>
            {timeLeft > 0 ? countdown(timeLeft) : timeStr}
          </span>
          <span className="rounded bg-white/5 px-1 py-0.2 text-[8px] text-white/40">
            {formatStr}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
