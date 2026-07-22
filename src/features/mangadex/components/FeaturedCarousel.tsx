import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import type { MangaInfo } from "../api";

interface FeaturedCarouselProps {
  items: MangaInfo[];
  loading: boolean;
  selectedTags?: string[];
  onToggleTag?: (id: string) => void;
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
  selectedTags = [],
  onToggleTag,
}: FeaturedCarouselProps) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [coverErrors, setCoverErrors] = useState<Set<number>>(new Set());
  // Whether the pointer is currently over the info panel — pauses auto-advance.
  const [hoveringInfo, setHoveringInfo] = useState(false);
  // Index being hovered on a dot — previews that title without committing.
  const [hoveredDot, setHoveredDot] = useState<number | null>(null);
  // Live idx used for rendering so hover-preview can override without losing idx.
  const activeIdx = hoveredDot ?? idx;

  // Clamp the active index if the list shrinks (e.g. refetch).
  useEffect(() => {
    if (idx > 0 && idx >= items.length) setIdx(0);
  }, [items.length, idx]);

  // Auto-advance every 7s, paused while the pointer is over the info panel.
  useEffect(() => {
    if (items.length <= 1 || hoveringInfo) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 7000);
    return () => clearInterval(t);
  }, [items.length, hoveringInfo]);

  if (loading) {
    return (
      <div className="mt-0 mb-8 h-[420px] w-full animate-pulse rounded-3xl bg-white/[0.04]" />
    );
  }

  if (items.length === 0) return null;

  return (
    <section className="mt-0 mb-8">
      <div className="glass relative h-[420px] w-full overflow-hidden rounded-3xl">
        {/* Cross-fading slides */}
        {items.map((m, i) => (
          <div
            key={m.id}
            className={`absolute inset-0 text-left transition-opacity duration-700 ${
              i === activeIdx ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"
            }`}
          >
            <div className="relative z-10 flex h-full w-full">
              {/* Left: poster autofitting the box height */}
              <div
                onClick={() => navigate(`/mangadex/manga/${m.id}`)}
                className="relative h-full shrink-0 overflow-hidden cursor-pointer group/poster"
                style={{ aspectRatio: "3 / 4" }}
              >
                {m.coverUrl && !coverErrors.has(activeIdx) ? (
                  <img
                    src={m.coverUrl}
                    alt={m.title}
                    onError={() =>
                      setCoverErrors((prev) => new Set(prev).add(activeIdx))
                    }
                    className="h-full w-full object-cover transition-transform duration-500 group-hover/poster:scale-105"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gradient-to-br from-yuui-accent/30 to-[#0f0f16] text-4xl">
                    📖
                  </div>
                )}
              </div>

              {/* Right: information panel, starting from the top.
                  Hovering pauses auto-advance so the user can read. */}
              <div
                className="relative flex min-w-0 flex-1 flex-col items-start justify-start gap-3 p-6 select-text"
                onMouseEnter={() => setHoveringInfo(true)}
                onMouseLeave={() => setHoveringInfo(false)}
              >
                <h2
                  onClick={() => navigate(`/mangadex/manga/${m.id}`)}
                  className="font-display text-2xl md:text-3xl font-bold leading-tight text-white drop-shadow-lg line-clamp-3 hover:text-yuui-accent transition-colors cursor-pointer select-text"
                >
                  {m.title}
                </h2>
                <p className="line-clamp-4 text-sm text-yuui-muted select-text">
                  {m.description || "No description available."}
                </p>

                {/* Tags */}
                {m.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 select-text">
                    {m.tags.slice(0, 8).map((t, tIdx) => {
                      const tagId = m.tagIds?.[tIdx];
                      const isSelected = tagId ? selectedTags.includes(tagId) : false;
                      return (
                        <button
                          key={t}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (tagId && onToggleTag) {
                              onToggleTag(tagId);
                            }
                          }}
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium backdrop-blur transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? "bg-yuui-accent text-white border border-yuui-accent/20"
                              : "bg-white/[0.06] text-white/70 hover:bg-white/15 hover:text-white"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-white/90 select-text">
                  {m.year != null && (
                    <span className="rounded-md bg-white/10 px-2 py-1 backdrop-blur select-text">
                      {m.year}
                    </span>
                  )}
                  <span className="rounded-md bg-white/10 px-2 py-1 capitalize backdrop-blur select-text">
                    {m.status}
                  </span>
                  {m.contentRating && (
                    <span className="rounded-md bg-white/10 px-2 py-1 capitalize backdrop-blur select-text">
                      {m.contentRating}
                    </span>
                  )}
                  <button
                    onClick={() => navigate(`/mangadex/manga/${m.id}`)}
                    className="inline-flex items-center gap-1 rounded-md bg-yuui-accent/80 px-3 py-1 font-semibold text-white hover:bg-yuui-accent transition-colors"
                  >
                    <Eye className="h-3 w-3" /> View
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Dots — hover to preview a title, click to commit */}
        <div className="absolute bottom-4 right-6 z-20 flex gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur border border-white/5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              onMouseEnter={() => setHoveredDot(i)}
              onMouseLeave={() => setHoveredDot(null)}
              className="group relative flex h-6 items-center justify-center px-1"
              aria-label={`Go to slide ${i + 1}`}
            >
              {/* Visual indicator */}
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === activeIdx
                    ? "w-6 bg-yuui-accent"
                    : "w-2 bg-white/30 group-hover:bg-white/60"
                }`}
              />
              {/* Tooltip on hover */}
              <span className="pointer-events-none absolute bottom-8 right-1/2 translate-x-1/2 whitespace-nowrap rounded bg-slate-950/90 border border-white/10 px-2.5 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 shadow-xl max-w-xs truncate">
                {items[i]?.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
