import { useEffect, useState } from "react";

export function useNextEpisodeCountdown(
  showNextPrompt: boolean,
  onPlayNext: () => void,
) {
  const [nextCountdown, setNextCountdown] = useState(5);

  // Next episode countdown
  useEffect(() => {
    if (!showNextPrompt) return;
    const interval = setInterval(() => {
      setNextCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onPlayNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showNextPrompt, onPlayNext]);

  return { nextCountdown, setNextCountdown };
}
