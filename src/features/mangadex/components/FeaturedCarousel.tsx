import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Star, Eye } from "lucide-react";
import type { MangaInfo } from "../api";

interface FeaturedCarouselProps {
  items: MangaInfo[];
  loading: boolean;
}

/**
 * Large hero carousel for the MangaDex landing page, modelled on the
 * MangaDex homepage's featured banner. Each slide shows a blurred
 * background cover, the crisp poster, title, description and a couple
 * of quick stats. Auto-advances every 7s and is fully clickable.
 */
export default function FeaturedCarousel({
  items,
  loading,
}: FeaturedCarouselProps) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);

  // Clamp the active index if the list shrinks (e.g. refetch).
  useEffect(() => {
    if (idx > 0 && idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length]);

  if (loading) {
    return (
      <div className="mt-6 h-[420px] w-full animate-pulse rounded-3xl bg-white/[0.04]" />
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/70">
        <Sparkles className="h-4 w-4 text-yuui-accent" /> Featured
      </div>

      <div className="relative h-[420px] w-full overflow-hidden rounded-3xl border border-white/[0.06]">
        {/* Cross-fading slides */}
        {items.map((m, i) => (
          <button
            key={m.id}
            onClick={() => navigate(`/mangadex/manga/${m.id}`)}
            className={`absolute inset-0 text-left transition-opacity duration-700 ${
              i === idx ? "opacity-100" : "opacity-0 pointer-events-none"
            }`}
          >
            {/* Blurred backdrop */}
            {m.coverUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center scale-110 blur-2xl"
                style={{ backgroundImage: `url(${m.coverUrl})` }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-yuui-accent/30 to-[#0f0f16]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/55 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

            {/* Crisp poster + content */}
            <div className="relative z-10 flex h-full items-end gap-6 p-8">
              <div className="hidden md:block w-[220px] shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
                {m.coverUrl ? (
                  <img
                    src={m.coverUrl}
                    alt={m.title}
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-[3/4] w-full place-items-center text-4xl">
                    📖
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 pb-2 max-w-3xl">
                <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-yuui-accent/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-yuui-accent backdrop-blur">
                  <Star className="h-3 w-3" /> Trending
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight text-white drop-shadow-lg line-clamp-2">
                  {m.title}
                </h2>
                <p className="mt-2 line-clamp-3 max-w-2xl text-sm text-white/70">
                  {m.description || "No description available."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/80">
                  {m.year != null && (
                    <span className="rounded-md bg-white/10 px-2 py-1 backdrop-blur">
                      {m.year}
                    </span>
                  )}
                  <span className="rounded-md bg-white/10 px-2 py-1 capitalize backdrop-blur">
                    {m.status}
                  </span>
                  {m.contentRating && (
                    <span className="rounded-md bg-white/10 px-2 py-1 capitalize backdrop-blur">
                      {m.contentRating}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-md bg-yuui-accent/80 px-3 py-1 font-semibold text-white">
                    <Eye className="h-3 w-3" /> View
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}

        {/* Dots */}
        <div className="absolute bottom-4 right-6 z-20 flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx
                  ? "w-6 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
