import type { AiringEpisode } from "../../features/calendar/api";
import {
  useAiringCardData,
  AiringCardCover,
  AiringCardInfo,
  AiringCardActions,
} from "./AiringCardShared";

interface AiringCardListProps {
  ep: AiringEpisode;
  inLibrary: boolean;
  cover: string | null;
  title: string;
  studioName: string | undefined;
  statusText: string;
  timeLeft: number;
  isFavorited: boolean;
  handleNavigate: () => void;
  handleSetStatus: () => void;
  handleToggleFavorite: () => void;
}

export default function AiringCardList({
  ep,
  inLibrary,
  cover,
  title,
  studioName,
  statusText,
  timeLeft,
  isFavorited,
  handleNavigate,
  handleSetStatus,
  handleToggleFavorite,
}: AiringCardListProps) {
  const { isLive, formatDisplay, displayTimeStr, timeColorClass } =
    useAiringCardData({
      ep,
      cover,
      title,
      timeLeft,
      statusText,
    });

  const borderClass = inLibrary
    ? "bg-yuui-accent/5 border border-yuui-accent/20"
    : "bg-white/5 border border-white/5";

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl p-2 transition-all duration-300 ${borderClass}`}
      onClick={handleNavigate}
    >
      {/* Cover Image */}
      <AiringCardCover cover={cover} title={title} ep={ep} isLive={isLive}>
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
      </AiringCardCover>

      {/* Info */}
      <AiringCardInfo
        title={title}
        studioName={studioName}
        formatDisplay={formatDisplay}
        displayTimeStr={displayTimeStr}
        timeColorClass={timeColorClass}
        episode={ep.episode}
        showEpisode
      />

      {/* Actions */}
      <AiringCardActions
        onSetStatus={handleSetStatus}
        onToggleFavorite={handleToggleFavorite}
        isFavorited={isFavorited}
      />
    </div>
  );
}
