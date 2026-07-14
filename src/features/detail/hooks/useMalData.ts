import { useEffect, useState } from "react";

/** Fetches MAL score/rank/popularity from Jikan for the given MAL id. */
export function useMalData(idMal: number | null | undefined) {
  const [malData, setMalData] = useState<{
    score: number | null;
    rank: number | null;
    popularity: number | null;
  } | null>(null);

  // Fetch MAL details from Jikan dynamically
  useEffect(() => {
    if (!idMal) {
      setMalData(null);
      return;
    }
    let alive = true;
    fetch(`https://api.jikan.moe/v4/anime/${idMal}`)
      .then((r) => r.json())
      .then((res) => {
        if (alive && res.data) {
          setMalData({
            score: res.data.score,
            rank: res.data.rank,
            popularity: res.data.popularity,
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [idMal]);

  return malData;
}
