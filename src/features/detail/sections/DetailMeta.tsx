import type { NavigateFunction } from "react-router-dom";
import type { AniListMediaDetail, MediaTag } from "../../../lib/types";
import { countdown } from "../../../lib/format";
import { Section } from "../components/Section";

export function DetailMeta({
  media,
  showTrailer,
  trailerUrl,
  description,
  studios,
  tags,
  color,
  navigate,
}: {
  media: AniListMediaDetail | null;
  showTrailer: boolean;
  trailerUrl: string | null;
  description: string;
  studios: { id: number; name: string }[];
  tags: MediaTag[];
  color: string;
  navigate: NavigateFunction;
}) {
  return (
    <>
      {/* Airing countdown */}
      {media?.nextAiringEpisode && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-yuui-accent/20 border border-yuui-accent/35 px-4 py-2 text-sm font-bold text-pink-400 shadow-[0_0_12px_rgba(255,95,162,0.15)]">
          ◷ Ep {media.nextAiringEpisode.episode} in{" "}
          {countdown(media.nextAiringEpisode.timeUntilAiring)}
        </div>
      )}

      {/* Trailer embed */}
      {showTrailer && trailerUrl && (
        <div className="mt-6 aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border border-white/10">
          <iframe
            src={trailerUrl}
            title="Trailer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
      )}

      {/* Synopsis */}
      {description && (
        <Section title="Synopsis">
          <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-white/75">
            {description}
          </p>
        </Section>
      )}

      {/* Meta grid: studios, genres, tags */}
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {(studios.length > 0 || (media?.genres?.length ?? 0) > 0) && (
          <div>
            {studios.length > 0 && (
              <div className="mb-4">
                <div className="mb-2 text-xs uppercase tracking-wider text-yuui-muted">
                  Studios
                </div>
                <div className="flex flex-wrap gap-2">
                  {studios.map((s) => (
                    <span
                      key={s.id}
                      className="glass rounded-lg px-3 py-1 text-sm"
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(media?.genres?.length ?? 0) > 0 && (
              <div>
                <div className="mb-2 text-xs uppercase tracking-wider text-yuui-muted">
                  Genres
                </div>
                <div className="flex flex-wrap gap-2">
                  {media!.genres.map((g) => (
                    <button
                      key={g}
                      onClick={() =>
                        navigate(`/discover?genre=${encodeURIComponent(g)}`)
                      }
                      className="rounded-lg px-3 py-1 text-sm cursor-pointer hover:scale-105 active:scale-95 transition-all text-left"
                      style={{ background: `${color}22`, color: "#e9e9f2" }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tags.length > 0 && (
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-yuui-muted">
              Tags
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <button
                  key={t.name}
                  onClick={() =>
                    navigate(`/discover?tag=${encodeURIComponent(t.name)}`)
                  }
                  className="glass rounded-lg px-2.5 py-1 text-xs text-white/70 cursor-pointer hover:bg-white/[0.08] hover:text-white active:scale-95 transition-all text-left"
                >
                  {t.name}
                  {t.rank != null && (
                    <span className="ml-1 text-yuui-muted">{t.rank}%</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
