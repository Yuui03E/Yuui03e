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
  const {
    isFavorited,
    favCount,
    toastMsg,
    handleNavigate,
    handleSetStatus,
    handleToggleFavorite,
  } = useAiringActions(ep);

  const title = ep.media.title.english || ep.media.title.romaji || "Unknown";
  const cover = ep.media.coverImage.extraLarge || ep.media.coverImage.large;
  const color = ep.media.coverImage.color || "#7c5cff";
  const formatStr = ep.media.format ? ep.media.format.replace("_", " ") : "TV";
  const studioName = ep.media.studios?.nodes?.[0]?.name;

  if (cardStyle === "board") {
    return (
      <AiringCardBoard
        ep={ep}
        inLibrary={inLibrary}
        posterWidth={posterWidth}
        cover={cover}
        color={color}
        title={title}
        studioName={studioName}
        formatStr={formatStr}
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
        inLibrary={inLibrary}
        cover={cover}
        color={color}
        title={title}
        studioName={studioName}
        statusText={statusText}
        timeLeft={timeLeft}
        isFavorited={isFavorited}
        favCount={favCount}
        toastMsg={toastMsg}
        handleNavigate={handleNavigate}
        handleSetStatus={handleSetStatus}
        handleToggleFavorite={handleToggleFavorite}
      />
    );
  }

  return (
    <AiringCardList
      ep={ep}
      inLibrary={inLibrary}
      posterWidth={posterWidth}
      cover={cover}
      color={color}
      title={title}
      studioName={studioName}
      statusText={statusText}
      timeLeft={timeLeft}
      isFavorited={isFavorited}
      favCount={favCount}
      toastMsg={toastMsg}
      handleNavigate={handleNavigate}
      handleSetStatus={handleSetStatus}
      handleToggleFavorite={handleToggleFavorite}
    />
  );
}
