import { motion } from "framer-motion";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { X } from "lucide-react";
import TitleBarControls from "../TitleBarControls";

interface PlayerTopBarProps {
  episodeNumber: number;
  title: string;
  onClose: () => void;
}

export default function PlayerTopBar({
  episodeNumber,
  title,
  onClose,
}: PlayerTopBarProps) {
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

  return (
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
  );
}
