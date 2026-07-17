import { useEffect, useState } from "react";
import type { AiringEpisode } from "../../features/calendar/api";

export function useAiringCountdown(ep: AiringEpisode) {
  const [timeLeft, setTimeLeft] = useState(
    ep.airingAt - Math.floor(Date.now() / 1000),
  );
  const [statusText, setStatusText] = useState("");
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const id = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const left = ep.airingAt - now;
      setTimeLeft(left);

      if (left <= 0) {
        setStatusText("Airing Now");
        setTimeStr("LIVE");
      } else {
        setStatusText("Airing in");
        const d = Math.floor(left / 86400);
        const h = Math.floor((left % 86400) / 3600);
        const m = Math.floor((left % 3600) / 60);
        const s = left % 60;
        const parts = [];
        if (d) parts.push(`${d}d`);
        if (h) parts.push(`${h}h`);
        if (m) parts.push(`${m}m`);
        parts.push(`${s}s`);
        setTimeStr(parts.join(" "));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [ep.airingAt]);

  return { timeLeft, statusText, timeStr };
}
