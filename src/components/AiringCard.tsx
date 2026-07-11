import { useEffect, useState } from "react";
import {
  Play,
  Calendar as CalendarIcon,
  Plus,
  Heart,
  Check,
  Tv,
} from "lucide-react";
import { countdown } from "../lib/format";

interface AiringEpisode {
  id: number;
  airingAt: number;
  episode: number;
  media: {
    id: number;
    title: { romaji: string | null; english: string | null };
    coverImage: {
      extraLarge: string | null;
      large: string | null;
      color: string | null;
    };
    format: string | null;
    season: string | null;
    seasonYear: number | null;
    favourites: number | null;
  };
}

export default function AiringCard({
  ep,
  inLibrary,
}: {
  ep: AiringEpisode;
  inLibrary: boolean;
}) {
  const [timeLeft, setTimeLeft] = useState(
    ep.airingAt - Math.floor(Date.now() / 1000),
  );

  useEffect(() => {
    setTimeLeft(ep.airingAt - Math.floor(Date.now() / 1000));
  }, [ep.airingAt]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft(ep.airingAt - Math.floor(Date.now() / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [ep.airingAt]);

  const title = ep.media.title.english || ep.media.title.romaji || "Unknown";
  const cover = ep.media.coverImage.extraLarge || ep.media.coverImage.large;
  const color = ep.media.coverImage.color || "var(--accent)";
  const airDate = new Date(ep.airingAt * 1000);
  const timeStr = airDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusText =
    timeLeft > 0 ? `Airing in ${countdown(timeLeft)}` : `Aired at ${timeStr}`;

  // Formatted season and format meta
  const seasonStr = ep.media.season
    ? ep.media.season.charAt(0) + ep.media.season.slice(1).toLowerCase()
    : "";
  const yearStr = ep.media.seasonYear ? String(ep.media.seasonYear) : "";
  const formatStr = ep.media.format ? ep.media.format.replace("_", " ") : "TV";
  const metaText = [[seasonStr, yearStr].filter(Boolean).join(" "), formatStr]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-left w-full h-full justify-between">
      {/* Top Section (Cover image + floating circular badge) */}
      <div className="w-full aspect-video rounded-xl overflow-hidden relative bg-white/5 border border-white/5 shrink-0">
        {cover ? (
          <img src={cover} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="grid h-full w-full place-items-center text-4xl animate-pulse"
            style={{
              background: `linear-gradient(135deg, ${color}33, #0f0f16)`,
            }}
          >
            🌸
          </div>
        )}

        {/* Floating badge top-right */}
        <div
          className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center text-white shadow-lg shadow-black/40 border border-white/10 z-10 transition-transform active:scale-95"
          style={{
            background: inLibrary ? "var(--accent)" : "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
          }}
          title={inLibrary ? "In Library" : "Not in Library"}
        >
          {inLibrary ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Tv className="h-3.5 w-3.5" />
          )}
        </div>
      </div>

      {/* Info Block */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {/* Title */}
        <h3
          className="text-sm font-bold text-foreground leading-snug line-clamp-2"
          title={title}
        >
          {title}
        </h3>

        {/* Dimmed Subtitle Line */}
        <div className="text-xs text-muted-foreground font-semibold line-clamp-1">
          Episode {ep.episode} · {formatStr}
        </div>

        {/* Meta row with Calendar Icon */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 font-medium">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          <span className="truncate">{metaText || "Upcoming"}</span>
        </div>
      </div>

      {/* Watch Button & Countdown */}
      <div className="flex flex-col gap-2 w-full mt-1 shrink-0">
        <button className="flex h-9 w-full items-center justify-center gap-2 rounded-full bg-surface-elevated text-xs font-semibold text-white border border-border hover:bg-white/[0.08] active:scale-[0.98] transition-all">
          <Play className="h-3 w-3 fill-white" />
          Watch
        </button>
        <div
          className={`text-[11px] font-bold text-center ${timeLeft > 0 ? "text-yuui-accent3" : "text-muted-foreground"}`}
        >
          {statusText}
        </div>
      </div>

      {/* Footer Divider & Controls */}
      <div className="border-t border-border pt-3 flex items-center justify-between w-full shrink-0">
        {/* Add button */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-elevated border border-border text-muted-foreground hover:bg-white/[0.08] hover:text-foreground active:scale-95 transition-all"
          title="Add to Library"
        >
          <Plus className="h-4 w-4" />
        </button>

        {/* Heart icon + count */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
          <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500/25" />
          <span>
            {ep.media.favourites ? ep.media.favourites.toLocaleString() : "0"}
          </span>
        </div>
      </div>
    </div>
  );
}
