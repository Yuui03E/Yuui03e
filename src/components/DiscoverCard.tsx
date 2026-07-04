import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play } from "lucide-react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useLibrary } from "../store/library";

interface DiscoverAnime {
  id: number;
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null; extraLarge: string | null; color: string | null };
  averageScore: number | null;
  seasonYear: number | null;
  format: string | null;
  description: string | null;
  bannerImage: string | null;
  genres: string[];
  status: string | null;
  episodes: number | null;
  trailer: { id: string | null; site: string | null } | null;
}

export default function DiscoverCard({
  anime,
  onClick,
}: {
  anime: DiscoverAnime;
  onClick: () => void;
}) {
  const { entries } = useLibrary();
  const [isHovered, setIsHovered] = useState(false);
  const [showVideo, setShowVideo] = useState(false);

  const title = anime.title ? (anime.title.english || anime.title.romaji || "Unknown") : "Unknown";
  const cover = anime.coverImage ? (anime.coverImage.extraLarge || anime.coverImage.large) : null;
  const color = anime.coverImage?.color || "var(--accent)";

  // Look up local library entry to check for local video preview
  const localEntry = entries.find(
    (e) =>
      e.media?.id === anime.id ||
      (e.media?.title.english && e.media.title.english === anime.title.english) ||
      (e.media?.title.romaji && e.media.title.romaji === anime.title.romaji)
  );

  const previewFile = localEntry?.files.find((f) => f.video_preview != null);
  const previewUrl = previewFile ? convertFileSrc(previewFile.video_preview!) : null;

  // YouTube trailer preview url
  const trailerId = anime.trailer?.site === "youtube" && anime.trailer?.id ? anime.trailer.id : null;
  const youtubeUrl = trailerId
    ? `https://www.youtube.com/embed/${trailerId}?autoplay=1&mute=1&loop=1&playlist=${trailerId}&controls=0&modestbranding=1&rel=0&iv_load_policy=3`
    : null;

  useEffect(() => {
    let timer: number;
    if (isHovered) {
      timer = window.setTimeout(() => {
        setShowVideo(true);
      }, 400);
    } else {
      setShowVideo(false);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [isHovered]);

  return (
    <div className="relative group">
      {/* Background glow utilizing anime color or theme accent */}
      <div
        className="absolute -inset-1 rounded-2xl opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: color }}
      />

      <motion.div
        whileHover={{ scale: 1.05 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={onClick}
        className="relative cursor-pointer overflow-hidden rounded-xl border border-white/[0.06] bg-yuui-panel shadow-card w-full aspect-[2/3]"
      >
        {/* Video Preview Overlay */}
        <AnimatePresence>
          {showVideo && (
            <>
              {/* Local File Video Preview */}
              {previewUrl && (
                <motion.video
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  src={previewUrl}
                  muted
                  loop
                  autoPlay
                  className="absolute inset-0 h-full w-full object-cover z-20"
                />
              )}

              {/* Fallback YouTube Trailer Stream (cropped to hide title/controls/watermark overlays) */}
              {!previewUrl && youtubeUrl && (
                <motion.iframe
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  src={youtubeUrl}
                  className="absolute z-20 pointer-events-none"
                  style={{
                    width: "400%",
                    height: "150%",
                    left: "-150%",
                    top: "-25%",
                  }}
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                />
              )}
            </>
          )}
        </AnimatePresence>

        {/* Cover Image */}
        {cover ? (
          <img
            src={cover}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center text-4xl"
            style={{ background: `linear-gradient(135deg, ${color}33, #0f0f16)` }}
          >
            🌸
          </div>
        )}

        {/* Normal Top-Left Badge (Visible when not hovered) */}
        {!isHovered && anime.averageScore != null && (
          <div className="absolute left-2 top-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-yuui-accent3 backdrop-blur z-10">
            ★ {anime.averageScore}
          </div>
        )}

        {/* Dark bottom-to-top gradient (h-[60%] overlay) */}
        <div
          className={`absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/95 via-black/50 to-transparent z-10 transition-opacity duration-300 ${
            isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        />

        {/* Hover Text Block (Slide-up title and badges) */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={isHovered ? { y: 0, opacity: 1 } : { y: 12, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="absolute bottom-0 left-0 right-0 p-3 z-30 pointer-events-none flex flex-col gap-1.5"
        >
          <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white drop-shadow">
            {title}
          </h3>
          <div className="flex flex-wrap gap-1 text-[9px] text-muted-foreground font-semibold">
            {anime.averageScore != null && (
              <span className="rounded bg-black/50 px-1 py-0.5 text-yuui-accent3 backdrop-blur border border-white/[0.04]">
                ★ {anime.averageScore}
              </span>
            )}
            {anime.format && (
              <span className="rounded bg-black/50 px-1 py-0.5 backdrop-blur border border-white/[0.04]">
                {anime.format.replace("_", " ")}
              </span>
            )}
            {anime.episodes != null && (
              <span className="rounded bg-black/50 px-1 py-0.5 backdrop-blur border border-white/[0.04]">
                {anime.episodes} eps
              </span>
            )}
          </div>
        </motion.div>

        {/* Play Icon Indicator Overlay */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={isHovered ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-3 right-3 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30 cursor-pointer hover:scale-110 active:scale-95 transition-transform"
        >
          <Play className="h-3.5 w-3.5 fill-white ml-0.5" />
        </motion.div>
      </motion.div>
    </div>
  );
}
