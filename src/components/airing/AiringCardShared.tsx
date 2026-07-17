import type { AiringEpisode } from "../../features/calendar/api";
import { useMemo } from "react";

interface SharedAiringCardProps {
  ep: AiringEpisode;
  cover: string | null;
  title: string;
  timeLeft: number;
  timeStr?: string;
  statusText?: string;
}

export function useAiringCardData({
  ep,
  cover,
  timeLeft,
  timeStr,
  statusText,
}: SharedAiringCardProps) {
  const isLive = timeLeft <= 0;
  const formatDisplay = useMemo(
    () => (ep.media.format ? ep.media.format.replace("_", " ") : "TV"),
    [ep.media.format],
  );

  const displayTimeStr = useMemo(() => {
    if (isLive) return "LIVE";
    if (timeStr) return timeStr;
    if (statusText) return statusText;
    return "";
  }, [isLive, timeStr, statusText]);

  const timeColorClass = useMemo(
    () => (isLive ? "text-pink-400" : "text-yuui-accent"),
    [isLive],
  );

  const borderClass = useMemo(
    () => (cover ? "border-yuui-accent/30" : "border-white/5"),
    [cover],
  );

  return {
    isLive,
    formatDisplay,
    displayTimeStr,
    timeColorClass,
    borderClass,
  };
}

export function AiringCardCover({
  cover,
  title,
  ep,
  isLive,
  isFavorited,
  onToggleFavorite,
  children,
}: {
  cover: string | null;
  title: string;
  ep: AiringEpisode;
  isLive: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative aspect-[2/3] overflow-hidden">
      {cover && (
        <img
          src={cover}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
      )}

      {/* Color overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Episode badge */}
      <div className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-mono font-bold text-white">
        Ep {ep.episode}
      </div>

      {/* Live indicator */}
      {isLive && (
        <div className="absolute top-2 right-2 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
          LIVE
        </div>
      )}

      {/* Favorite button (Grid variant) */}
      {onToggleFavorite && isFavorited !== undefined && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute bottom-2 right-2 rounded-full bg-black/70 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={
            isFavorited ? "Remove from favorites" : "Add to favorites"
          }
        >
          {isFavorited ? (
            <svg
              className="w-4 h-4 text-pink-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          )}
        </button>
      )}

      {children}
    </div>
  );
}

export function AiringCardInfo({
  title,
  studioName,
  formatDisplay,
  displayTimeStr,
  timeColorClass,
  episode,
  showEpisode = false,
}: {
  title: string;
  studioName: string | undefined;
  formatDisplay: string;
  displayTimeStr: string;
  timeColorClass: string;
  episode?: number;
  showEpisode?: boolean;
}) {
  return (
    <div className="p-3 space-y-1.5">
      <h4 className="font-display text-sm font-bold text-white line-clamp-1">
        {title}
      </h4>

      <div className="flex items-center gap-2 text-[10px] text-yuui-muted">
        {studioName && <span>{studioName}</span>}
        <span>•</span>
        <span>{formatDisplay}</span>
        {showEpisode && episode && (
          <>
            <span>•</span>
            <span>Ep {episode}</span>
          </>
        )}
      </div>

      {/* Countdown */}
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span className={`font-bold ${timeColorClass}`}>{displayTimeStr}</span>
      </div>
    </div>
  );
}

export function AiringCardActions({
  onSetStatus,
  onToggleFavorite,
  isFavorited,
}: {
  onSetStatus?: () => void;
  onToggleFavorite?: () => void;
  isFavorited?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {onToggleFavorite && isFavorited !== undefined && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="rounded-full bg-black/50 p-1.5 text-white hover:bg-yuui-accent/50 transition-colors"
          aria-label={
            isFavorited ? "Remove from favorites" : "Add to favorites"
          }
        >
          {isFavorited ? (
            <svg
              className="w-4 h-4 text-pink-400"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          )}
        </button>
      )}

      {onSetStatus && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetStatus();
          }}
          className="rounded-full bg-black/50 p-1.5 text-white hover:bg-yuui-accent/50 transition-colors"
          aria-label="Set status"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
