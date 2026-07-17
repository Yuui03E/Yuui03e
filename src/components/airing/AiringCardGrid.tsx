import type { AiringEpisode } from "../../features/calendar/api";
import {
  useAiringCardData,
  AiringCardCover,
  AiringCardInfo,
  AiringCardActions,
} from "./AiringCardShared";

interface AiringCardGridProps {
  ep: AiringEpisode;
  cover: string | null;
  title: string;
  studioName: string | undefined;
  statusText: string;
  timeLeft: number;
  isFavorited: boolean;
  handleNavigate: () => void;
  handleToggleFavorite: () => void;
}

export default function AiringCardGrid({
  ep,
  cover,
  title,
  studioName,
  statusText,
  timeLeft,
  isFavorited,
  handleNavigate,
  handleToggleFavorite,
}: AiringCardGridProps) {
  const { isLive, formatDisplay, displayTimeStr, timeColorClass, borderClass } =
    useAiringCardData({
      ep,
      cover,
      title,
      timeLeft,
      statusText,
    });

  return (
    <div
      className={`group relative rounded-xl overflow-hidden border transition-all duration-300 ${borderClass}`}
      onClick={handleNavigate}
    >
      {/* Cover Image */}
      <AiringCardCover
        cover={cover}
        title={title}
        ep={ep}
        isLive={isLive}
        isFavorited={isFavorited}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Info */}
      <AiringCardInfo
        title={title}
        studioName={studioName}
        formatDisplay={formatDisplay}
        displayTimeStr={displayTimeStr}
        timeColorClass={timeColorClass}
      />

      {/* Actions */}
      <AiringCardActions
        onToggleFavorite={handleToggleFavorite}
        isFavorited={isFavorited}
      />
    </div>
  );
}
