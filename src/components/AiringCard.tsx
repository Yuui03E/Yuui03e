import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart,
  Check,
  Bookmark,
  Info,
} from "lucide-react";
import { countdown, cleanDescription } from "../lib/format";
import { useLibrary } from "../store/library";
import { graphqlAnilist } from "../lib/api";

interface AiringEpisode {
  id: number;
  airingAt: number;
  episode: number;
  media: {
    id: number;
    title: { romaji: string | null; english: string | null; native: string | null };
    coverImage: {
      extraLarge: string | null;
      large: string | null;
      color: string | null;
    };
    bannerImage: string | null;
    format: string | null;
    season: string | null;
    seasonYear: number | null;
    favourites: number | null;
    genres: string[];
    averageScore: number | null;
    description: string | null;
    episodes: number | null;
    studios: {
      nodes: { id: number; name: string }[];
    } | null;
  };
}

export default function AiringCard({
  ep,
  inLibrary,
  cardStyle = "list",
  posterWidth = 135,
}: {
  ep: AiringEpisode;
  inLibrary: boolean;
  cardStyle?: "board" | "grid" | "list";
  posterWidth?: number;
}) {
  const navigate = useNavigate();
  const { anilistUser, entries } = useLibrary();
  const [timeLeft, setTimeLeft] = useState(
    ep.airingAt - Math.floor(Date.now() / 1000),
  );
  const [showTrackPicker, setShowTrackPicker] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [favCount, setFavCount] = useState(ep.media.favourites ?? 0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setTimeLeft(ep.airingAt - Math.floor(Date.now() / 1000));
  }, [ep.airingAt]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(ep.airingAt - Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [ep.airingAt, timeLeft]);

  const title = ep.media.title.english || ep.media.title.romaji || "Unknown";
  const cover = ep.media.coverImage.extraLarge || ep.media.coverImage.large;
  const color = ep.media.coverImage.color || "#7c5cff";
  const airDate = new Date(ep.airingAt * 1000);
  const timeStr = airDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusText =
    timeLeft > 0 ? `Airing in ${countdown(timeLeft)}` : `Aired at ${timeStr}`;

  const formatStr = ep.media.format ? ep.media.format.replace("_", " ") : "TV";
  const studioName = ep.media.studios?.nodes?.[0]?.name;

  const handleNavigate = () => {
    const local = entries.find((e) => e.media?.id === ep.media.id && e.files && e.files.length > 0);
    const key = local ? local.key : `anilist:${ep.media.id}`;
    navigate(`/anime/${encodeURIComponent(key)}`);
  };

  const handleSetStatus = async (status: string) => {
    if (!anilistUser) {
      triggerToast("Please connect your AniList account first");
      return;
    }
    try {
      await graphqlAnilist(
        `mutation ($mediaId: Int, $status: MediaListStatus) {
          SaveMediaListEntry (mediaId: $mediaId, status: $status) {
            id
            status
          }
        }`,
        { mediaId: ep.media.id, status: status.toUpperCase() }
      );
      triggerToast(`Added to ${status}`);
    } catch (e) {
      console.error(e);
      triggerToast("Failed to update status on AniList");
    }
  };

  const handleToggleFavorite = async () => {
    if (!anilistUser) {
      triggerToast("Please connect your AniList account first");
      return;
    }
    try {
      await graphqlAnilist(
        `mutation ($mediaId: Int) {
          ToggleFavourite (animeId: $mediaId) {
            anime {
              id
            }
          }
        }`,
        { mediaId: ep.media.id }
      );
      setIsFavorited(!isFavorited);
      setFavCount((c) => (isFavorited ? c - 1 : c + 1));
      triggerToast(isFavorited ? "Removed from Favorites" : "Added to Favorites");
    } catch (e) {
      console.error(e);
      triggerToast("Failed to update favorites");
    }
  };

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Dynamic glow and border colors matching the cover color variable
  const dynamicStyles = {
    borderColor: isHovered ? `${color}40` : "rgba(255,255,255,0.05)",
    boxShadow: isHovered
      ? `0 0 25px ${color}15, inset 0 0 12px ${color}08`
      : "none",
  };

  if (cardStyle === "board") {
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

  if (cardStyle === "grid") {
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

  // Default: Horizontal List split card style
  const synopsis = cleanDescription(ep.media.description);

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      style={dynamicStyles}
      className="glass group relative flex flex-col sm:flex-row gap-4 rounded-2xl border bg-yuui-surface/30 p-4 text-left w-full justify-between transition-all duration-300 overflow-hidden"
    >
      {/* Toast Alert overlay */}
      {toastMsg && (
        <div className="absolute top-2 left-2 right-2 bg-black/90 border border-white/10 text-white rounded-xl py-1.5 px-3 text-[10px] font-bold text-center z-50 shadow-lg backdrop-blur">
          {toastMsg}
        </div>
      )}

      {/* Left side: Large Portrait Poster Cover */}
      <div
        onClick={handleNavigate}
        style={{ width: posterWidth, height: Math.round(posterWidth * 1.5) }}
        className="aspect-[2/3] rounded-xl overflow-hidden relative bg-white/5 border border-white/5 shrink-0 cursor-pointer shadow-lg w-full sm:w-auto"
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
          <div
            className="absolute top-2 left-2 h-6 w-6 rounded-full flex items-center justify-center text-white border border-emerald-500/20 bg-emerald-500/80 backdrop-blur-[2px] shadow-md shadow-black/20"
            title="In Library"
          >
            <Check className="h-3 w-3 text-white" />
          </div>
        )}

        {ep.media.averageScore && (
          <div className="absolute top-2 right-2 rounded-lg bg-black/60 border border-white/10 px-1.5 py-0.5 text-[8px] font-bold text-yuui-accent3 backdrop-blur-[2px]">
            ★ {ep.media.averageScore}%
          </div>
        )}


      </div>

      {/* Right side: Detailed Information Column */}
      <div className="flex-1 flex flex-col justify-between min-w-0">
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
            className="text-sm font-bold text-white hover:text-white cursor-pointer leading-snug line-clamp-2 transition-colors truncate-none"
            title={title}
            style={{ color: isHovered ? color : "#ffffff" }}
          >
            {title}
          </h3>

          {/* Meta row: Studio, episode and total eps */}
          <div className="flex items-center justify-between text-[10px] font-medium text-yuui-muted">
            <span className="truncate max-w-[65%]">{studioName || "Unknown Studio"}</span>
            <span className="shrink-0">Ep {ep.episode} {ep.media.episodes ? `/ ${ep.media.episodes}` : ""}</span>
          </div>

          {/* Synopsis (Static clamped) */}
          {synopsis ? (
            <p className="text-[10px] text-white/50 leading-relaxed line-clamp-3">
              {synopsis}
            </p>
          ) : (
            <p className="text-[10px] text-white/30 italic">No synopsis available.</p>
          )}

          {/* Genres tag pills */}
          {ep.media.genres.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {ep.media.genres.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="rounded-md px-1.5 py-0.5 text-[8px] font-bold text-white/50"
                  style={{ background: `${color}10`, border: `1px solid ${color}15` }}
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-white/[0.04] pt-3 mt-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {/* View Details */}
            <button
              onClick={handleNavigate}
              className="flex h-7 px-2.5 items-center justify-center gap-1 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.1] active:scale-[0.96] text-[10px] font-bold text-white/90 hover:text-white transition-all cursor-pointer"
            >
              <Info className="h-3 w-3 text-white/70" />
              Details
            </button>

            {/* Track watchlist */}
            <div className="relative">
              <button
                onClick={() => setShowTrackPicker(!showTrackPicker)}
                className={`flex h-7 w-7 items-center justify-center rounded-xl border transition-all cursor-pointer ${
                  showTrackPicker
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "bg-white/5 border-white/5 text-white/60 hover:bg-white/[0.1] hover:text-white"
                }`}
                title="Track Status"
              >
                <Bookmark className="h-3 w-3" />
              </button>

              {showTrackPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowTrackPicker(false)} />
                  <div className="absolute bottom-full mb-2 left-0 bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5 min-w-[120px]">
                    {["Watching", "Planning", "Completed", "Paused", "Dropped"].map((status) => (
                      <button
                        key={status}
                        onClick={() => handleSetStatus(status)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold text-left text-white/80 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Favorite toggle */}
          <button
            onClick={handleToggleFavorite}
            className={`flex h-7 items-center gap-1 px-2.5 rounded-xl border transition-all cursor-pointer ${
              isFavorited
                ? "border-red-500/30 bg-red-500/10 text-red-400"
                : "bg-white/5 border-white/5 text-white/60 hover:bg-white/[0.1] hover:text-white"
            }`}
          >
            <Heart className={`h-3 w-3 ${isFavorited ? "fill-red-500" : ""}`} />
            <span className="text-[9px] font-bold font-mono">
              {favCount.toLocaleString()}
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
