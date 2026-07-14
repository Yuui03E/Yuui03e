import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { StoredEntry } from "../lib/types";

function titleOf(e: StoredEntry): string {
  return (
    e.media?.title.english || e.media?.title.romaji || e.title || "Unknown"
  );
}

export default function AnimeCard({
  entry,
  index,
  playbackHistory = [],
  onQuickView,
  onResume,
}: {
  entry: StoredEntry;
  index: number;
  playbackHistory?: any[];
  onQuickView?: (entry: StoredEntry) => void;
  onResume?: (video: { path: string; episode: number; title: string }) => void;
}) {
  const navigate = useNavigate();
  const activePlay = playbackHistory.find((item) =>
    entry.files.some((f: any) => f.path === item.file_path)
  );
  const cover =
    entry.media?.coverImage.extraLarge || entry.media?.coverImage.large || null;
  const color = entry.media?.coverImage.color || "#7c5cff";
  const title = titleOf(entry);
  const eps = entry.episode_count;
  const score = entry.media?.averageScore;
  const fav = entry.user?.favorite;
  const missing = entry.analysis?.missing_episodes.length ?? 0;

  const [isHovered, setIsHovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    let t: number;
    if (isHovered) {
      t = window.setTimeout(() => {
        setShowVideo(true);
      }, 500);
    } else {
      setShowVideo(false);
    }
    return () => clearTimeout(t);
  }, [isHovered]);

  const previewFile = entry.files.find((f: any) => f.video_preview != null);
  const previewUrl = previewFile
    ? convertFileSrc(previewFile.video_preview!)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.6), duration: 0.4 }}
      whileHover={{ y: -6 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={() => navigate(`/anime/${encodeURIComponent(entry.key)}`)}
      onContextMenu={(e) => {
        if (!onQuickView) return;
        e.preventDefault();
        onQuickView(entry);
      }}
      className="group relative cursor-pointer"
    >
      <div
        className="absolute inset-0 rounded-2xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: color }}
      />
      <motion.div
        layoutId={`cover-${entry.key}`}
        className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-yuui-panel shadow-card"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden">
          <AnimatePresence>
            {showVideo && previewUrl && (
              <motion.video
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                src={previewUrl}
                muted
                loop
                autoPlay
                className="absolute inset-0 h-full w-full object-cover z-10"
              />
            )}
          </AnimatePresence>
          {cover ? (
            <img
              src={cover}
              alt={title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
            />
          ) : (
            <div
              className="grid h-full w-full place-items-center text-4xl"
              style={{
                background: `linear-gradient(160deg, ${color}55, #141420)`,
              }}
            >
              🌸
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

          {/* badges */}
          <div className="absolute left-2 top-2 flex flex-wrap gap-1">
            {score != null && (
              <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-yuui-accent3 backdrop-blur">
                ★ {score}
              </span>
            )}
            {missing > 0 && (
              <span className="rounded-md bg-red-500/80 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                {missing} missing
              </span>
            )}
          </div>

          {fav && (
            <div className="absolute right-2 top-2 text-sm text-yuui-accent drop-shadow">
              ♥
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3 flex flex-col gap-1.5 justify-end">
            {activePlay && activePlay.duration > 0 && (
              <div
                className={`w-full space-y-1 ${onResume ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
                onClick={(e) => {
                  if (!onResume) return;
                  e.stopPropagation();
                  onResume({
                    path: activePlay.file_path,
                    episode: activePlay.episode ?? 1,
                    title:
                      activePlay.title ||
                      `${title} - Episode ${activePlay.episode ?? 1}`,
                  });
                }}
              >
                <div className="flex items-center justify-between text-[9px] font-bold text-white/95 drop-shadow">
                  <span>Resume Ep {activePlay.episode}</span>
                  <span>{Math.round((activePlay.position / activePlay.duration) * 100)}%</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yuui-accent to-yuui-accent2 rounded-full"
                    style={{ width: `${(activePlay.position / activePlay.duration) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div>
              <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-white drop-shadow">
                {title}
              </h3>
              <p className="mt-1 text-[11px] text-white/60">
                {eps} {eps === 1 ? "episode" : "episodes"}
                {entry.release_groups[0] ? ` · ${entry.release_groups[0]}` : ""}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
