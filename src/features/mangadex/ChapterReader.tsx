import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Maximize2,
  Minimize2,
  Move,
} from "lucide-react";
import { getChapterPages, getChapters, getMangaDetail, saveReadingProgress } from "./api";
import type { ChapterInfo } from "./api";
import type { MangaDexPage } from "./types";
import { useLibrary } from "../../store/library";
import ReaderContextMenu from "./components/ReaderContextMenu";

type ReaderMode = "paged" | "scroll";
type FitMode = "width" | "height" | "original";

/** Stash the mangaId so ChapterReader can locate sibling chapters.
 *  Set by MangaDetail just before navigating to the reader. */
declare global {
  interface Window {
    __mdNav?: { 
      mangaId?: string;
      title?: string;
      coverUrl?: string;
    };
  }
}

function useMangaIdForChapter(chapterId: string | undefined): {
  mangaId: string | null;
  allChapters: ChapterInfo[];
} {
  const [mangaId, setMangaId] = useState<string | null>(null);
  const [allChapters, setAllChapters] = useState<ChapterInfo[]>([]);

  useEffect(() => {
    if (!chapterId) return;
    let alive = true;
    (async () => {
      const mid = window.__mdNav?.mangaId ?? null;
      if (!alive) return;
      setMangaId(mid);
      if (mid) {
        try {
          const chs = await getChapters(mid);
          if (alive) setAllChapters(chs);
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [chapterId]);

  return { mangaId, allChapters };
}

export default function ChapterReader() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const {
    mangadexReaderMode,
    mangadexReaderFit,
    setMangadexReaderMode,
    setMangadexReaderFit,
  } = useLibrary();

  const [pages, setPages] = useState<MangaDexPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  // Right-click context menu position (null = closed).
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { mangaId, allChapters } = useMangaIdForChapter(chapterId);
  const [mangaDetail, setMangaDetail] = useState<{ title?: string; coverUrl?: string | null } | null>(null);

  useEffect(() => {
    if (!mangaId) return;
    let alive = true;
    const cachedTitle = window.__mdNav?.title;
    const cachedCover = window.__mdNav?.coverUrl;
    if (cachedTitle && cachedCover) {
      setMangaDetail({ title: cachedTitle, coverUrl: cachedCover });
      return;
    }

    getMangaDetail(mangaId)
      .then((detail) => {
        if (alive && detail) {
          setMangaDetail({ title: detail.title, coverUrl: detail.coverUrl });
        }
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, [mangaId]);

  const mode: ReaderMode = mangadexReaderMode;
  const fit: FitMode = mangadexReaderFit;

  // Sibling chapters (ascending by chapter number).
  const { prevChapter, nextChapter } = useMemo(() => {
    if (!chapterId || allChapters.length === 0)
      return { prevChapter: undefined, nextChapter: undefined };
    const asc = [...allChapters].sort((a, b) => {
      const an = parseFloat(a.chapter ?? "");
      const bn = parseFloat(b.chapter ?? "");
      if (isNaN(an)) return 1;
      if (isNaN(bn)) return -1;
      return an - bn;
    });
    const idx = asc.findIndex((c) => c.id === chapterId);
    return {
      prevChapter: idx > 0 ? asc[idx - 1] : undefined,
      nextChapter: idx < asc.length - 1 ? asc[idx + 1] : undefined,
    };
  }, [chapterId, allChapters]);

  // ---- Load chapter pages + persist initial progress ------------------
  useEffect(() => {
    if (!chapterId) return;
    setLoading(true);
    getChapterPages(chapterId)
      .then((p) => {
        setPages(p);
        
        let initialPage = 0;
        const cached = localStorage.getItem(`yuui_md_page_${chapterId}`);
        if (cached) {
          const parts = cached.split("/");
          if (parts.length > 0) {
            const pageNum = parseInt(parts[0], 10);
            if (!isNaN(pageNum) && pageNum > 0 && pageNum <= p.length) {
              initialPage = pageNum - 1;
            }
          }
        }
        setCurrentPage(initialPage);
        setScrollPage(initialPage);

        if (mangaId) {
          const cn = allChapters.find((c) => c.id === chapterId)?.chapter ?? null;
          const frac = p.length > 0 ? (initialPage + 1) / p.length : 0;
          saveReadingProgress(chapterId!, mangaId, cn, frac, mangaDetail?.title, mangaDetail?.coverUrl).catch(() => {});
        }
      })
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, mangaId, mangaDetail]);

  // Scroll initial page into view in scroll mode
  useEffect(() => {
    if (!loading && mode === "scroll" && currentPage > 0 && scrollRef.current) {
      const targetImg = scrollRef.current.querySelector(`[data-page-idx="${currentPage}"]`);
      if (targetImg) {
        setTimeout(() => {
          targetImg.scrollIntoView({ block: "start" });
        }, 120);
      }
    }
  }, [loading, mode, currentPage]);

  // Sync title and cover to DB as soon as details are loaded/resolved
  useEffect(() => {
    if (mangaId && mangaDetail && allChapters.length > 0) {
      const cn = allChapters.find((c) => c.id === chapterId)?.chapter ?? null;
      let initialPage = 0;
      const cached = localStorage.getItem(`yuui_md_page_${chapterId}`);
      if (cached) {
        const parts = cached.split("/");
        if (parts.length > 0) {
          const pageNum = parseInt(parts[0], 10);
          if (!isNaN(pageNum) && pageNum > 0 && pageNum <= pages.length) {
            initialPage = pageNum - 1;
          }
        }
      }
      const frac = pages.length > 0 ? (initialPage + 1) / pages.length : 0;
      saveReadingProgress(chapterId!, mangaId, cn, frac, mangaDetail.title, mangaDetail.coverUrl).catch(() => {});
    }
  }, [mangaId, mangaDetail, allChapters, chapterId, pages.length]);

  // ---- Debounced progress writes -------------------------------------
  const saveTimer = useRef<number | null>(null);
  const persistProgress = (frac: number, pageIndex: number) => {
    if (!chapterId || !mangaId) return;
    const cn = allChapters.find((c) => c.id === chapterId)?.chapter ?? null;
    
    // Save current page info in localStorage for history view
    if (pages.length > 0) {
      localStorage.setItem(`yuui_md_page_${chapterId}`, `${pageIndex + 1}/${pages.length}`);
    }

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveReadingProgress(chapterId!, mangaId, cn, frac, mangaDetail?.title, mangaDetail?.coverUrl).catch(() => {});
    }, 400);
  };

  // ---- Paged-mode navigation ------------------------------------------
  const goNext = () => {
    if (currentPage < pages.length - 1) {
      const np = currentPage + 1;
      setCurrentPage(np);
      persistProgress((np + 1) / pages.length, np);
    } else if (nextChapter) {
      navigate(`/mangadex/reader/${nextChapter.id}`);
    }
  };

  const goPrev = () => {
    if (currentPage > 0) {
      const np = currentPage - 1;
      setCurrentPage(np);
      persistProgress((np + 1) / pages.length, np);
    } else if (prevChapter) {
      navigate(`/mangadex/reader/${prevChapter.id}`);
    }
  };

  const jumpTo = (page: number) => {
    const np = Math.max(0, Math.min(pages.length - 1, page));
    setCurrentPage(np);
    persistProgress((np + 1) / pages.length, np);
  };

  // ---- Scroll mode: IntersectionObserver to track current page -------
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPage, setScrollPage] = useState(0);
  useEffect(() => {
    if (mode !== "scroll") return;
    const container = scrollRef.current;
    if (!container) return;
    const imgs = Array.from(
      container.querySelectorAll<HTMLImageElement>("[data-page-idx]"),
    );
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const idx = Number((e.target as HTMLElement).dataset.pageIdx);
            if (!isNaN(idx)) {
              setScrollPage(idx);
              persistProgress((idx + 1) / pages.length, idx);
            }
          }
        }
      },
      { root: container, threshold: 0.55 },
    );
    imgs.forEach((img) => obs.observe(img));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pages.length]);

  // ---- Keyboard shortcuts ---------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
          if (mode === "paged") goNext();
          break;
        case "ArrowLeft":
          if (mode === "paged") goPrev();
          break;
        case "ArrowDown":
          if (mode === "scroll")
            scrollRef.current?.scrollBy({ top: 320, behavior: "smooth" });
          break;
        case "ArrowUp":
          if (mode === "scroll")
            scrollRef.current?.scrollBy({ top: -320, behavior: "smooth" });
          break;
        case "m":
        case "M":
          setMangadexReaderMode(mode === "paged" ? "scroll" : "paged");
          break;
        case "f":
        case "F":
          setMangadexReaderFit(
            fit === "width"
              ? "height"
              : fit === "height"
                ? "original"
                : "width",
          );
          break;
        case "n":
        case "N":
          if (nextChapter) navigate(`/mangadex/reader/${nextChapter.id}`);
          break;
        case "p":
        case "P":
          if (prevChapter) navigate(`/mangadex/reader/${prevChapter.id}`);
          break;
        case "h":
        case "H":
          setShowControls((s) => !s);
          break;
        case "Escape":
          navigate(-1);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, fit, currentPage, pages.length, prevChapter, nextChapter]);

  // ---- Auto-hide controls --------------------------------------------
  useEffect(() => {
    let h: number | null = null;
    const reveal = () => {
      setShowControls(true);
      if (h) window.clearTimeout(h);
      h = window.setTimeout(() => setShowControls(false), 2800);
    };
    window.addEventListener("mousemove", reveal);
    return () => {
      window.removeEventListener("mousemove", reveal);
      if (h) window.clearTimeout(h);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-yuui-accent/30 border-t-yuui-accent" />
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <p className="text-yuui-muted">Could not load chapter pages.</p>
        <button
          onClick={() => navigate(-1)}
          className="rounded-xl bg-yuui-accent px-4 py-2 text-sm font-semibold text-white"
        >
          Go back
        </button>
      </div>
    );
  }

  const displayPage = mode === "scroll" ? scrollPage : currentPage;
  const total = pages.length;

  const fitClass =
    fit === "width"
      ? "w-full h-auto max-w-full"
      : fit === "height"
        ? "max-h-full w-auto mx-auto"
        : "w-auto h-auto max-w-full max-h-full mx-auto";

  return (
    <div
      className="flex h-full flex-col bg-black"
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* Top bar */}
      <div
        className={`flex items-center justify-between px-4 py-2 bg-black/80 border-b border-white/[0.06] transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="text-sm text-white/60">
          Page {displayPage + 1} / {total}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setMangadexReaderMode(mode === "paged" ? "scroll" : "paged")
            }
            className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/[0.12]"
            title="Toggle mode (M)"
          >
            {mode === "paged" ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" /> Scroll
              </>
            ) : (
              <>
                <ChevronRight className="h-3.5 w-3.5" /> Paged
              </>
            )}
          </button>
          <button
            onClick={() =>
              setMangadexReaderFit(
                fit === "width"
                  ? "height"
                  : fit === "height"
                    ? "original"
                    : "width",
              )
            }
            className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/[0.12]"
            title="Cycle fit (F)"
          >
            {fit === "width" ? (
              <Maximize2 className="h-3.5 w-3.5" />
            ) : fit === "height" ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Move className="h-3.5 w-3.5" />
            )}
            <span className="capitalize">{fit}</span>
          </button>
        </div>
      </div>

      {/* Viewer */}
      {mode === "paged" ? (
        <div className="flex flex-1 items-center justify-center overflow-hidden relative">
          <button
            onClick={goPrev}
            disabled={currentPage === 0 && !prevChapter}
            className="absolute left-0 top-0 bottom-0 w-1/4 z-10 flex items-center justify-start pl-4 transition-opacity opacity-0 hover:opacity-100 disabled:opacity-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur">
              <ChevronLeft className="h-6 w-6 text-white" />
            </div>
          </button>

          {/* Preload adjacent pages (pivot ± 1). */}
          {pages[currentPage - 1] && (
            <link rel="preload" href={pages[currentPage - 1].url} as="image" />
          )}
          {pages[currentPage + 1] && (
            <link rel="preload" href={pages[currentPage + 1].url} as="image" />
          )}
          <motion.div
            key={currentPage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex h-full w-full items-center justify-center p-2"
          >
            <img
              src={pages[currentPage].url}
              alt={`Page ${currentPage + 1}`}
              className={`${fitClass} object-contain select-none`}
              draggable={false}
            />
          </motion.div>

          <button
            onClick={goNext}
            disabled={currentPage >= pages.length - 1 && !nextChapter}
            className="absolute right-0 top-0 bottom-0 w-1/4 z-10 flex items-center justify-end pr-4 transition-opacity opacity-0 hover:opacity-100 disabled:opacity-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur">
              <ChevronRight className="h-6 w-6 text-white" />
            </div>
          </button>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex flex-1 flex-col items-center overflow-y-auto px-2 py-4"
        >
          {pages.map((p, i) => (
            <img
              key={p.filename}
              data-page-idx={i}
              src={p.url}
              alt={`Page ${i + 1}`}
              loading="lazy"
              className={`select-none ${
                fit === "original"
                  ? "max-w-full h-auto"
                  : fit === "height"
                    ? "max-h-[88vh] w-auto mx-auto"
                    : "w-full max-w-full"
              }`}
              draggable={false}
            />
          ))}
          {nextChapter && (
            <button
              onClick={() => navigate(`/mangadex/reader/${nextChapter.id}`)}
              className="mt-6 mb-10 inline-flex items-center gap-2 rounded-xl bg-yuui-accent/20 px-4 py-2 text-xs font-semibold text-white hover:bg-yuui-accent/30"
            >
              Next Chapter
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Seek bar (paged mode only) */}
      {mode === "paged" && (
        <div
          className={`px-4 py-2 bg-black/80 border-t border-white/[0.06] transition-opacity duration-300 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={goPrev}
              disabled={currentPage === 0 && !prevChapter}
              className="text-white/70 hover:text-white disabled:opacity-30"
              title="Previous (←)"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <input
              type="range"
              min={0}
              max={total - 1}
              value={currentPage}
              onChange={(e) => jumpTo(Number(e.target.value))}
              className="flex-1 accent-yuui-accent"
            />
            <button
              onClick={goNext}
              disabled={currentPage >= total - 1 && !nextChapter}
              className="text-white/70 hover:text-white disabled:opacity-30"
              title="Next (→)"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <span className="text-[11px] text-white/60 tabular-nums w-16 text-right">
              {displayPage + 1} / {total}
            </span>
          </div>
          {(prevChapter || nextChapter) && (
            <div className="mt-1 flex justify-between text-[10px] text-yuui-muted">
              {prevChapter ? (
                <button
                  onClick={() => navigate(`/mangadex/reader/${prevChapter.id}`)}
                  className="hover:text-white/80"
                >
                  ← Prev Ch. {prevChapter.chapter ?? "?"}
                </button>
              ) : (
                <span />
              )}
              {nextChapter ? (
                <button
                  onClick={() => navigate(`/mangadex/reader/${nextChapter.id}`)}
                  className="hover:text-white/80"
                >
                  Next Ch. {nextChapter.chapter ?? "?"} →
                </button>
              ) : (
                <span />
              )}
            </div>
          )}
        </div>
      )}

      {/* Right-click context menu */}
      {menu && (
        <ReaderContextMenu
          x={menu.x}
          y={menu.y}
          mode={mode}
          fit={fit}
          showControls={showControls}
          currentPage={displayPage}
          totalPages={total}
          hasPrevChapter={!!prevChapter}
          hasNextChapter={!!nextChapter}
          onClose={() => setMenu(null)}
          onSetMode={(m) => {
            setMangadexReaderMode(m);
          }}
          onSetFit={(f) => {
            setMangadexReaderFit(f);
          }}
          onToggleControls={() => setShowControls((s) => !s)}
          onPrevPage={goPrev}
          onNextPage={goNext}
          onJumpTo={jumpTo}
          onPrevChapter={() => {
            if (prevChapter) navigate(`/mangadex/reader/${prevChapter.id}`);
          }}
          onNextChapter={() => {
            if (nextChapter) navigate(`/mangadex/reader/${nextChapter.id}`);
          }}
          onBack={() => navigate(-1)}
        />
      )}
    </div>
  );
}
