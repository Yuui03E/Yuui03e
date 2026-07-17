import type { AiringEpisode } from "../../features/calendar/api";

export function useAiringActions(ep: AiringEpisode) {
  const handleToggleFavorite = () => {
    // TODO: Implement toggle favorite
    console.log("Toggle favorite for:", ep.id);
  };

  const handleNavigate = () => {
    // TODO: Implement navigation
    console.log("Navigate to:", ep.id);
  };

  const handleSetStatus = () => {
    // TODO: Implement set status
    console.log("Set status for:", ep.id);
  };

  // Mock values for UI
  const isFavorited = false;

  return {
    isFavorited,
    handleNavigate,
    handleSetStatus,
    handleToggleFavorite,
  };
}
