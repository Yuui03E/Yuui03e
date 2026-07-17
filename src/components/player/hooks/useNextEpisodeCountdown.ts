import { useEffect, useState, useRef } from "react";

export function useNextEpisodeCountdown(
  showNextPrompt: boolean,
  onPlayNext: () => void,
) {
  const [nextCountdown, setNextCountdown] = useState(5);

  const playNextRef = useRef(onPlayNext);
  useEffect(() => {
    playNextRef.current = onPlayNext;
  }, [onPlayNext]);

  // Next episode countdown
  useEffect(() => {
    if (!showNextPrompt) return;
    const interval = setInterval(() => {
      setNextCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          playNextRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showNextPrompt]);

  return { nextCountdown, setNextCountdown };
}
