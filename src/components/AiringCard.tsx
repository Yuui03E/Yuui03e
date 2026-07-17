import type { AiringEpisode } from "./airing/types";
import { useAiringCountdown } from "./airing/useAiringCountdown";
import { useAiringActions } from "./airing/useAiringActions";
import AiringCardBoard from "./airing/AiringCardBoard";
import AiringCardGrid from "./airing/AiringCardGrid";
import AiringCardList from "./airing/AiringCardList";

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
  const { timeLeft, statusText, timeStr } = useAiringCountdown(ep);
  const { isFavorited, handleNavigate, handleSetStatus, handleToggleFavorite } =
    useAiringActions(ep);

  const title = ep.media.title.english || ep.media.title.romaji || "Unknown";
  const cover = ep.media.coverImage.extraLarge || ep.media.coverImage.large;
  const studioName = ep.media.studios?.nodes?.[0]?.name;

  if (cardStyle === "board") {
    return (
      <AiringCardBoard
        ep={ep}
        posterWidth={posterWidth}
        cover={cover}
        title={title}
        studioName={studioName}
        timeLeft={timeLeft}
        timeStr={timeStr}
        handleNavigate={handleNavigate}
      />
    );
  }

  if (cardStyle === "grid") {
    return (
      <AiringCardGrid
        ep={ep}
        cover={cover}
        title={title}
        studioName={studioName}
        statusText={statusText}
        timeLeft={timeLeft}
        isFavorited={isFavorited}
        handleNavigate={handleNavigate}
        handleToggleFavorite={handleToggleFavorite}
      />
    );
  }

  return (
    <AiringCardList
      ep={ep}
      inLibrary={inLibrary}
      cover={cover}
      title={title}
      studioName={studioName}
      statusText={statusText}
      timeLeft={timeLeft}
      isFavorited={isFavorited}
      handleNavigate={handleNavigate}
      handleSetStatus={handleSetStatus}
      handleToggleFavorite={handleToggleFavorite}
    />
  );
}
