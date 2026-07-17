import { motion } from "framer-motion";
import type { ViewerProfile } from "./types";

interface ProfileHeaderProps {
  profile: ViewerProfile | null;
  anilistUser: any;
  logoutAnilist: any;
  stats: any;
  coverSize: number;
  setCoverSize: (size: number) => void;
}

export default function ProfileHeader({ profile, anilistUser, logoutAnilist, stats, coverSize, setCoverSize }: ProfileHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col md:flex-row md:items-center gap-3.5 py-2.5 px-4 rounded-[20px] glass border border-white/[0.05] bg-yuui-surface/40 relative overflow-hidden shrink-0"
    >
      <div className="absolute top-0 right-0 w-64 h-32 bg-yuui-accent/5 blur-3xl rounded-full pointer-events-none" />

      <div className="flex items-center gap-3 relative z-10 shrink-0">
        <img
          src={profile?.avatar.large || "https://s4.anilist.co/file/anilist/user/avatar/large/default.png"}
          alt="Avatar"
          className="h-10 w-10 rounded-lg border border-white/10 hover:border-yuui-accent transition-all shadow-glow hover:scale-[1.02] object-cover shrink-0"
        />
        <div>
          <h1 className="text-base font-bold text-white tracking-tight leading-none font-display">
            {profile?.name || anilistUser?.name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-yuui-muted font-mono leading-none">
              @{profile?.name?.toLowerCase() || anilistUser?.name?.toLowerCase()}
            </span>
            <button
              onClick={logoutAnilist}
              className="text-[8.5px] font-bold text-red-400/90 hover:text-red-400 bg-red-500/10 hover:bg-red-500/15 border border-red-500/15 hover:border-red-500/30 px-1.5 py-0.5 rounded leading-none transition-all cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </div>

      {/* Unified Stats strip & slider container */}
      <div className="flex flex-wrap items-center gap-3 relative z-10 select-none md:ml-2">
        {/* Compact Stats Pill Strip */}
        <div className="glass rounded-xl px-3 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex items-center gap-3 text-[10.5px] shrink-0 h-[28px]">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-yuui-accent font-display">{stats.totalAnime}</span>
            <span className="text-[8.5px] text-yuui-muted font-semibold uppercase tracking-wider">Cloud Total</span>
          </div>
          <span className="text-white/10 select-none text-[9px]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-pink-400 font-display">{stats.completedCount}</span>
            <span className="text-[8.5px] text-yuui-muted font-semibold uppercase tracking-wider">Completed</span>
          </div>
          <span className="text-white/10 select-none text-[9px]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-white font-display">{stats.daysWatched}</span>
            <span className="text-[8.5px] text-yuui-muted font-semibold uppercase tracking-wider">Days</span>
          </div>
          <span className="text-white/10 select-none text-[9px]">|</span>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-pink-400 font-display">{stats.meanScore}</span>
            <span className="text-[8.5px] text-yuui-muted font-semibold uppercase tracking-wider">Mean Score</span>
          </div>
        </div>

        {/* Compact Cover Scale Slider */}
        <div className="glass rounded-xl px-2.5 py-1 border border-white/[0.04] bg-[#1a1d27]/40 flex items-center gap-2 shrink-0 h-[28px] text-[10px]">
          <span className="text-[8.5px] text-yuui-muted font-semibold uppercase tracking-wider select-none">Cover Size</span>
          <input
            type="range"
            min="40"
            max="140"
            value={coverSize}
            onChange={(e) => setCoverSize(parseInt(e.target.value))}
            className="w-16 accent-yuui-accent cursor-pointer h-0.5 rounded-lg bg-white/10"
          />
          <span className="font-mono font-bold text-white w-6 text-right select-none">{coverSize}px</span>
        </div>
      </div>
    </motion.header>
  );
}
