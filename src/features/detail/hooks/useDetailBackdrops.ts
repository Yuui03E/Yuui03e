import { useEffect } from "react";
import { useLibrary } from "../../../store/library";
import type { AniListMediaDetail } from "../../../lib/types";
import { getBackdrops } from "../../../lib/api";

/**
 * Drives the full-screen backdrop from the current media: shows the AniList
 * banner instantly (if any), then upgrades to high-res TMDB backdrops. Only
 * active when the user has opted into image backdrops.
 */
export function useDetailBackdrops(media: AniListMediaDetail | null) {
  const { setActiveBackdrops } = useLibrary();
  const imageBackdropEnabled = useLibrary((s) => s.imageBackdropEnabled);

  // The AniList banner is a true landscape image — safe as an instant first
  // frame. The portrait cover is intentionally NOT used here: stretching it
  // across the background is the low-quality case we're fixing.
  const banner = media?.bannerImage || null;
  const mediaId = media?.id ?? null;

  // Instant frame: show the AniList banner immediately (if any) so there's no
  // blank flash, then upgrade to high-res TMDB backdrops when they resolve.
  // Only runs when the user has opted into image backdrops; otherwise the app
  // keeps the live animated shader everywhere.
  useEffect(() => {
    if (!imageBackdropEnabled) {
      setActiveBackdrops([]);
      return;
    }

    let alive = true;
    setActiveBackdrops(banner ? [banner] : []);

    if (mediaId) {
      getBackdrops(
        mediaId,
        [media?.title.romaji, media?.title.english, media?.title.native],
        media?.seasonYear ?? null,
        media?.format ?? null,
      )
        .then((urls) => {
          if (!alive || urls.length === 0) return;
          // Lead with the banner (already loaded) then the higher-res TMDB
          // shots, de-duplicated, for a seamless upgrade.
          const combined = [banner, ...urls].filter(
            (u): u is string => !!u,
          );
          setActiveBackdrops(Array.from(new Set(combined)));
        })
        .catch(() => {
          /* keep the banner-only fallback on any error */
        });
    }

    return () => {
      alive = false;
    };
  }, [imageBackdropEnabled, banner, mediaId, setActiveBackdrops, media?.title.romaji, media?.title.english, media?.title.native, media?.seasonYear, media?.format]);
}
