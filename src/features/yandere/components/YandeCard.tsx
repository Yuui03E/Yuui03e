import { useState } from "react";
import { motion } from "framer-motion";
import { Heart, Download } from "lucide-react";
import type { YandePost } from "../../../lib/yandereApi";
import { useLibrary } from "../../../store/library";
import { downloadYandeImage } from "../../../lib/yandereApi";

interface YandeCardProps {
  post: YandePost;
  onOpenLightbox: (post: YandePost) => void;
}

export default function YandeCard({ post, onOpenLightbox }: YandeCardProps) {
  const {
    yandereBlurNSFW,
    yandereDownloadDir,
    yandereFavorites,
    toggleYandereFavorite,
    setToastMsg,
  } = useLibrary();

  const [loaded, setLoaded] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<"fav" | "download" | null>(null);

  // Progressive image source fallback: sample -> jpeg -> preview -> file_url
  const primaryUrl = post.sample_url || post.jpeg_url || post.preview_url || post.file_url;
  const [currentSrc, setCurrentSrc] = useState(primaryUrl);

  const isFavorite = yandereFavorites.some((f) => f.id === post.id);
  const isNSFW = post.rating === "q" || post.rating === "e";
  const shouldBlur = isNSFW && yandereBlurNSFW;

  const handleImageError = () => {
    if (currentSrc === post.sample_url && post.jpeg_url) {
      setCurrentSrc(post.jpeg_url);
    } else if (currentSrc !== post.preview_url && post.preview_url) {
      setCurrentSrc(post.preview_url);
    } else if (currentSrc !== post.file_url && post.file_url) {
      setCurrentSrc(post.file_url);
    } else {
      setLoaded(true);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const filename = `yuui_yande_${post.id}_original.${post.file_ext || "jpg"}`;
      await downloadYandeImage(
        String(post.id),
        post.file_url || post.sample_url,
        filename,
        yandereDownloadDir
      );
    } catch {
      setToastMsg("Download failed");
    }
  };

  const handleFavToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleYandereFavorite(post);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={() => onOpenLightbox(post)}
      className="group relative cursor-pointer overflow-hidden rounded-lg bg-surface-elevated/20 transition-all duration-200 hover:z-10 break-inside-avoid mb-1"
    >
      {/* Skeleton loading placeholder */}
      {!loaded && (
        <div
          className="w-full animate-pulse bg-gradient-to-tr from-surface via-surface-elevated to-surface"
          style={{ height: `${Math.max(160, Math.min(450, (post.height / post.width) * 220))}px` }}
        />
      )}

      {/* Dynamic image */}
      <img
        src={currentSrc}
        alt={`Artwork ${post.id}`}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={handleImageError}
        className={`w-full h-auto block object-cover transition-all duration-300 group-hover:scale-[1.02] ${
          loaded ? "opacity-100" : "opacity-0 absolute inset-0"
        } ${shouldBlur ? "blur-xl saturate-50 group-hover:blur-sm" : ""}`}
        loading="lazy"
      />

      {/* Ultra-Minimalist Hover Overlay with Stylish Rounded Pill Tooltips */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 flex flex-col justify-between p-2.5 pointer-events-none">
        {/* Top Favorite Action */}
        <div className="flex items-center justify-end gap-2 pointer-events-auto">
          {hoveredAction === "fav" && (
            <motion.span
              initial={{ opacity: 0, x: 5 }}
              animate={{ opacity: 1, x: 0 }}
              className="rounded-full bg-black/90 border border-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xl backdrop-blur-xl"
            >
              {isFavorite ? "Favorited" : "Favorite"}
            </motion.span>
          )}

          <button
            onClick={handleFavToggle}
            onMouseEnter={() => setHoveredAction("fav")}
            onMouseLeave={() => setHoveredAction(null)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/10 backdrop-blur-xl transition-all shadow-md cursor-pointer ${
              isFavorite
                ? "bg-rose-500 text-white border-rose-400 shadow-rose-500/40"
                : "bg-black/60 text-white/90 hover:bg-black/90 hover:border-white/30"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${isFavorite ? "fill-current" : ""}`} />
          </button>
        </div>

        {/* Bottom minimal score + download button */}
        <div className="flex items-center justify-between pointer-events-auto">
          <span className="text-[11px] font-mono text-white/90 font-bold flex items-center gap-1.5 bg-black/60 border border-white/10 px-2.5 py-1 rounded-full backdrop-blur-xl">
            <Heart className="h-3 w-3 text-rose-400 fill-rose-400" />
            {post.score}
          </span>

          <div className="flex items-center gap-2">
            {hoveredAction === "download" && (
              <motion.span
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-full bg-black/90 border border-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xl backdrop-blur-xl"
              >
                Download Original (HD)
              </motion.span>
            )}

            <button
              onClick={handleDownload}
              onMouseEnter={() => setHoveredAction("download")}
              onMouseLeave={() => setHoveredAction(null)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/60 hover:bg-accent hover:border-accent text-white backdrop-blur-xl transition-all shadow-md cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
