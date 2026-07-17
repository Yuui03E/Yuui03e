import type { AiringEpisode } from "../../features/calendar/api";
import {
  useAiringCardData,
  AiringCardCover,
  AiringCardInfo,
} from "./AiringCardShared";

interface AiringCardBoardProps {
  ep: AiringEpisode;
  posterWidth: number;
  cover: string | null;
  title: string;
  studioName: string | undefined;
  timeLeft: number;
  timeStr: string;
  handleNavigate: () => void;
}

export default function AiringCardBoard({
  ep,
  posterWidth,
  cover,
  title,
  studioName,
  timeLeft,
  timeStr,
  handleNavigate,
}: AiringCardBoardProps) {
  const { isLive, formatDisplay, displayTimeStr, timeColorClass, borderClass } =
    useAiringCardData({
      ep,
      cover,
      title,
      timeLeft,
      statusText: timeStr,
    });

  return (
    <div
      className={`group relative w-full rounded-xl overflow-hidden border transition-all duration-300 ${borderClass}`}
      onClick={handleNavigate}
      style={{ width: posterWidth }}
    >
      {/* Cover Image */}
      <AiringCardCover cover={cover} title={title} ep={ep} isLive={isLive} />

      {/* Info */}
      <AiringCardInfo
        title={title}
        studioName={studioName}
        formatDisplay={formatDisplay}
        displayTimeStr={displayTimeStr}
        timeColorClass={timeColorClass}
      />
    </div>
  );
}
