import { useEffect, useState } from "react";
import { countdown } from "../../lib/format";
import type { AiringEpisode } from "./types";

// timeLeft state + the two countdown effects. Derived airing strings are
// computed here so every variant reads the same status text. airingAt and
// timeStr are passed/derived from ep to avoid capturing stale state.
export function useAiringCountdown(ep: AiringEpisode) {
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
  }, [ep.airingAt, timeLeft]);

  const airDate = new Date(ep.airingAt * 1000);
  const timeStr = airDate.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusText =
    timeLeft > 0 ? `Airing in ${countdown(timeLeft)}` : `Aired at ${timeStr}`;

  return { timeLeft, statusText, timeStr };
}
