import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getChapterPages,
  getChapters,
  getMangaDetail,
  getMangaIdFromChapter,
  saveReadingProgress,
} from "../api";
import type { ChapterInfo } from "../api";
import type { MangaDexPage } from "../types";
import { useLibrary } from "../../../store/library";
import ReaderContextMenu from "./ReaderContextMenu";

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
      fromHistory?: boolean;
    };
  }
}

/** Map the resize-algorithm pref to the CSS `image-rendering` value. */
const IMAGE_RENDERING: Record<string, React.CSSProperties["imageRendering"]> = {
  best: "auto", // browser smooth (bilinear/lanczos) scaling
  medium: "crisp-edges", // sharper lines, some aliasing
  fast: "pixelated", // nearest-neighbor, fastest
};

const BACKGROUND_CLASS: Record<string, string> = {
  black: "bg-black",
  gray: "bg-neutral-800",
  white: "bg-white",
};

function useMangaIdForChapter(chapterId: string | undefined): {
  mangaId: string | null;
  allChapters: ChapterInfo[];
  resolvedTitle: string | null;
  resolvedCoverUrl: string | null;
} {
  const [mangaId, setMangaId] = useState<string | null>(null);
  const [allChapters, setAllChapters] = useState<ChapterInfo[]>([]);
  const [resolvedTitle, setResolvedTitle] = useState<string | null>(null);
  const [resolvedCoverUrl, setResolvedCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!chapterId) return;
    let alive = true;
    (async () => {
      let mid = window.__mdNav?.mangaId ?? null;
      let title = window.__mdNav?.title ?? null;
      let coverUrl = window.__mdNav?.coverUrl ?? null;

      if (!mid) {
        const res = await getMangaIdFromChapter(chapterId);
        mid = res.mangaId;
        if (!title) title = res.title;
        if (!coverUrl) coverUrl = res.coverUrl;
      }

      if (!alive) return;
      if (mid) setMangaId(mid);
      if (title) setResolvedTitle(title);
      if (coverUrl) setResolvedCoverUrl(coverUrl);

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

  return { mangaId, allChapters, resolvedTitle, resolvedCoverUrl };
}

export default function ChapterReader() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const {
    mangadexReaderMode,
    mangadexReaderFit,
    mangadexReaderPrefs: prefs,
    setMangadexReaderMode,
    setMangadexReaderFit,
    setMangadexReaderPrefs,
  } = useLibrary();

  const [pages, setPages] = useState<MangaDexPage[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loading, setLoading] = useState(true);
  // Controls visibility is two-layered: `autoVisible` follows mouse activity
  // (reveals on move, fades after idle), while `userHidden` is the explicit
  // "Hide Controls" toggle (H key / menu) that wins over mouse movement.
  const [autoVisible, setAutoVisible] = useState(true);
  const [userHidden, setUserHidden] = useState(false);
  const showControls = autoVisible && !userHidden;
  // Right-click context menu position (null = closed).
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const { mangaId, allChapters, resolvedTitle, resolvedCoverUrl } =
    useMangaIdForChapter(chapterId);
  const [mangaDetail, setMangaDetail] = useState<{
    title?: string;
    coverUrl?: string | null;
  } | null>(null);

  const mode: ReaderMode = mangadexReaderMode;
  const fit: FitMode = mangadexReaderFit;
  const rtl = prefs.direction === "rtl";
  // Pages advanced per step in paged mode (2 for double-page spreads).
  const step = mode === "paged" && prefs.doublePage ? 2 : 1;

  useEffect(() => {
    if (!mangaId) return;
    let alive = true;
    const cachedTitle = window.__mdNav?.title ?? resolvedTitle;
    const cachedCover = window.__mdNav?.coverUrl ?? resolvedCoverUrl;
    if (cachedTitle) {
      setMangaDetail({ title: cachedTitle, coverUrl: cachedCover });
      if (cachedCover) return;
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
  }, [mangaId, resolvedTitle, resolvedCoverUrl]);

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

  const chapterNumber =
    allChapters.find((c) => c.id === chapterId)?.chapter ?? null;

  // ---- Load chapter pages + persist initial progress ------------------
  useEffect(() => {
    if (!chapterId) return;
    setLoading(true);
    getChapterPages(chapterId, prefs.imageQuality)
      .then((p) => {
        setPages(p);

        let initialPage = 0;
        try {
          const cached = localStorage.getItem(`yuui_md_page_${chapterId}`);
          if (cached) {
            const parts = cached.split("/");
            if (parts.length > 0) {
              const pageNum = parseInt(parts[0], 10);
              // Restore mid-chapter progress only. A saved position on the
              // final page means the chapter was finished (or the position was
              // poisoned by the old zero-height-observer bug) — restart from
              // page 1 instead of opening at the end.
              if (!isNaN(pageNum) && pageNum > 0 && pageNum < p.length) {
                initialPage = pageNum - 1;
              }
            }
          }
        } catch {
          // localStorage unavailable — proceed without cached page
        }
        setCurrentPage(initialPage);
        setScrollPage(initialPage);

        if (mangaId) {
          const cn =
            allChapters.find((c) => c.id === chapterId)?.chapter ?? null;
          const frac = p.length > 0 ? (initialPage + 1) / p.length : 0;
          saveReadingProgress(
            chapterId!,
            mangaId,
            cn,
            frac,
            mangaDetail?.title,
            mangaDetail?.coverUrl,
          ).catch(() => {});
        }
      })
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, mangaId, mangaDetail, prefs.imageQuality]);

  // Scroll initial page into view in scroll mode
  useEffect(() => {
    if (!loading && currentPage > 0 && scrollRef.current) {
      const targetImg = scrollRef.current.querySelector(
        `[data-page-idx="${currentPage}"]`,
      );
      if (targetImg) {
        setTimeout(() => {
          targetImg.scrollIntoView({ block: "start" });
        }, 120);
      }
    }
  }, [loading, currentPage]);

  // Sync title and cover to DB as soon as details are loaded/resolved
  useEffect(() => {
    if (mangaId && mangaDetail && allChapters.length > 0) {
      const cn = allChapters.find((c) => c.id === chapterId)?.chapter ?? null;
      let initialPage = 0;
      try {
        const cached = localStorage.getItem(`yuui_md_page_${chapterId}`);
        if (cached) {
          const parts = cached.split("/");
          if (parts.length > 0) {
            const pageNum = parseInt(parts[0], 10);
            // Mid-chapter positions only (see the page-load effect above).
            if (!isNaN(pageNum) && pageNum > 0 && pageNum < pages.length) {
              initialPage = pageNum - 1;
            }
          }
        }
      } catch {
        // localStorage unavailable — proceed without cached page
      }
      const frac = pages.length > 0 ? (initialPage + 1) / pages.length : 0;
      saveReadingProgress(
        chapterId!,
        mangaId,
        cn,
        frac,
        mangaDetail.title,
        mangaDetail.coverUrl,
      ).catch(() => {});
    }
  }, [mangaId, mangaDetail, allChapters, chapterId, pages.length]);

  // ---- Debounced progress writes -------------------------------------
  const saveTimer = useRef<number | null>(null);
  const persistProgress = (frac: number, pageIndex: number) => {
    if (!chapterId || !mangaId) return;
    const cn = allChapters.find((c) => c.id === chapterId)?.chapter ?? null;

    // Save current page info in localStorage for history view
    if (pages.length > 0) {
      try {
        localStorage.setItem(
          `yuui_md_page_${chapterId}`,
          `${pageIndex + 1}/${pages.length}`,
        );
      } catch {
        // localStorage may be full or unavailable — silently ignore
      }
    }

    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveReadingProgress(
        chapterId!,
        mangaId,
        cn,
        frac,
        mangaDetail?.title,
        mangaDetail?.coverUrl,
      ).catch(() => {});
    }, 400);
  };

  // ---- Paged-mode navigation ------------------------------------------
  const goNext = () => {
    if (currentPage < pages.length - step) {
      const np = Math.min(pages.length - 1, currentPage + step);
      setCurrentPage(np);
      persistProgress((np + 1) / pages.length, np);
    } else if (currentPage < pages.length - 1) {
      // Odd remainder in double-page mode: land on the final page.
      const np = pages.length - 1;
      setCurrentPage(np);
      persistProgress((np + 1) / pages.length, np);
    } else if (nextChapter) {
      navigate(`/mangadex/reader/${nextChapter.id}`, { replace: true });
    }
  };

  const goPrev = () => {
    if (currentPage > 0) {
      const np = Math.max(0, currentPage - step);
      setCurrentPage(np);
      persistProgress((np + 1) / pages.length, np);
    } else if (prevChapter) {
      navigate(`/mangadex/reader/${prevChapter.id}`, { replace: true });
    }
  };

  const jumpTo = (page: number) => {
    const np = Math.max(0, Math.min(pages.length - 1, page));
    setCurrentPage(np);
    persistProgress((np + 1) / pages.length, np);
  };

  /** Top-left header Back button: returns to History tab if opened from history,
   *  otherwise replaces reader entry with the manga details page. */
  const goBackHeader = () => {
    if (window.__mdNav?.fromHistory) {
      navigate("/mangadex?tab=history", { replace: true });
    } else if (mangaId) {
      navigate(`/mangadex/manga/${mangaId}`, { replace: true });
    } else {
      navigate("/mangadex", { replace: true });
    }
  };

  /** Context menu "Back to Manga" button: replaces reader entry with the manga details page. */
  const goBackToMangaDetail = () => {
    if (mangaId) {
      navigate(`/mangadex/manga/${mangaId}`, { replace: true });
    } else {
      navigate("/mangadex", { replace: true });
    }
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
          // Ignore images that haven't loaded yet: lazy-loaded pages start at
          // zero height, and zero-area elements report isIntersecting=true —
          // on mount ALL pages "intersect" at once, which used to persist the
          // last page as the reading position (chapter opened at the end).
          if (e.boundingClientRect.height === 0) continue;
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

  // ---- Keyboard shortcuts (rebindable via prefs.keys) ------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't steal keys while typing in the context-menu inputs.
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // Escape is fixed: close menu, else back to the manga.
      if (e.key === "Escape") {
        if (menu) setMenu(null);
        else goBackHeader();
        return;
      }

      const key = e.key.toLowerCase();
      const k = prefs.keys;
      switch (key) {
        case k.prevPage:
          // In RTL (manga) direction, the "prev" key advances instead.
          if (mode === "paged") (rtl ? goNext : goPrev)();
          break;
        case k.nextPage:
          if (mode === "paged") (rtl ? goPrev : goNext)();
          break;
        case k.scrollDown:
          if (mode === "scroll")
            scrollRef.current?.scrollBy({ top: 320, behavior: "smooth" });
          break;
        case k.scrollUp:
          if (mode === "scroll")
            scrollRef.current?.scrollBy({ top: -320, behavior: "smooth" });
          break;
        case k.toggleMode:
          setMangadexReaderMode(mode === "paged" ? "scroll" : "paged");
          break;
        case k.cycleFit:
          setMangadexReaderFit(
            fit === "width" ? "height" : fit === "height" ? "original" : "width",
          );
          break;
        case k.nextChapter:
          if (nextChapter) navigate(`/mangadex/reader/${nextChapter.id}`);
          break;
        case k.prevChapter:
          if (prevChapter) navigate(`/mangadex/reader/${prevChapter.id}`);
          break;
        case k.toggleControls:
          setUserHidden((s) => !s);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode,
    fit,
    rtl,
    currentPage,
    pages.length,
    prevChapter,
    nextChapter,
    menu,
    prefs.keys,
  ]);

  // ---- Window title-bar slot ------------------------------------------
  // The reader renders its Back button + title INSIDE the app's borderless
  // window title bar via a portal into #titlebar-slot (see TitleBar.tsx).
  // The slot sits above the drag region, so the button is clickable there.
  const [titlebarSlot, setTitlebarSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTitlebarSlot(document.getElementById("titlebar-slot"));
  }, []);

  // The title bar spans the full window width, but the sidebar (56px) sits
  // under its left edge — offset the portal content so the Back button
  // doesn't render on top of the sidebar. Tracks live hide/show toggles.
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      return localStorage.getItem("yuui_sidebar_hidden") === "true";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const onSidebar = (e: Event) =>
      setSidebarHidden((e as CustomEvent).detail?.hidden === true);
    window.addEventListener("yuui:sidebar", onSidebar);
    return () => window.removeEventListener("yuui:sidebar", onSidebar);
  }, []);

  // ---- Auto-hide controls on mouse idle ------------------------------
  useEffect(() => {
    let h: number | null = null;
    const reveal = () => {
      setAutoVisible(true);
      if (h) window.clearTimeout(h);
      h = window.setTimeout(() => setAutoVisible(false), 2800);
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
          onClick={goBackHeader}
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

  // Shared per-image style derived from the display prefs.
  const imgStyle: React.CSSProperties = {
    imageRendering: IMAGE_RENDERING[prefs.quality] ?? "auto",
    filter:
      prefs.brightness !== 100
        ? `brightness(${prefs.brightness / 100})`
        : undefined,
    // Chromium (WebView2) layout zoom — scales the image while the
    // overflow-auto container provides panning when it exceeds the view.
    zoom: prefs.zoom !== 100 ? prefs.zoom / 100 : undefined,
  };

  const bgClass = BACKGROUND_CLASS[prefs.background] ?? "bg-black";
  const isLightBg = prefs.background === "white";

  // In RTL, the left click zone / arrow advances, the right goes back.
  const leftAction = rtl ? goNext : goPrev;
  const rightAction = rtl ? goPrev : goNext;
  const leftDisabled = rtl
    ? currentPage >= pages.length - 1 && !nextChapter
    : currentPage === 0 && !prevChapter;
  const rightDisabled = rtl
    ? currentPage === 0 && !prevChapter
    : currentPage >= pages.length - 1 && !nextChapter;

  // Pages shown in paged mode (1 or 2 for double-page spreads).
  const spread = prefs.doublePage
    ? [pages[currentPage], pages[currentPage + 1]].filter(Boolean)
    : [pages[currentPage]];
  // Manga spreads read right-to-left: first page goes on the right.
  const orderedSpread = rtl ? [...spread].reverse() : spread;

  return (
    <div
      className={`flex h-full flex-col ${bgClass}`}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {/* Back button + title live INSIDE the window title bar (portal into
          TitleBar's #titlebar-slot, which sits above the drag region — the
          only way to make them clickable in the top 40px strip). Interactive
          children opt out of dragging with pointer-events-auto + no-drag. */}
      {titlebarSlot &&
        createPortal(
          <div
            className={`flex h-full min-w-0 flex-1 items-center gap-3 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
            style={{ paddingLeft: sidebarHidden ? 12 : 56 + 12 }}
          >
            {/* Back button — top left, in the title bar */}
            <button
              onClick={goBackHeader}
              data-tauri-drag-region="false"
              className={`no-drag flex shrink-0 items-center gap-1.5 rounded-lg bg-black/40 px-2.5 py-1 text-sm text-white/70 backdrop-blur transition-colors hover:bg-black/60 hover:text-white ${
                showControls ? "pointer-events-auto" : "pointer-events-none"
              }`}
              title="Back (Esc)"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            {/* Title and chapter — single line (drag-through) */}
            <h1 className="pointer-events-none min-w-0 flex-1 truncate text-center text-sm font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {mangaDetail?.title ?? "Unknown Manga"}
              {chapterNumber && (
                <span className="text-white/60"> · Chapter {chapterNumber}</span>
              )}
            </h1>

            {/* Spacer mirrors the back button so the title stays centered */}
            <span className="invisible flex shrink-0 items-center gap-1.5 px-2.5 py-1 text-sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </span>
          </div>,
          titlebarSlot,
        )}

      {/* Viewer */}
      {mode === "paged" ? (
        <div className="relative flex-1 overflow-auto">
          <button
            onClick={leftAction}
            disabled={leftDisabled}
            className="fixed left-0 top-0 bottom-0 w-1/4 z-10 flex items-center justify-start pl-4 transition-opacity opacity-0 hover:opacity-100 disabled:opacity-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur">
              <ChevronLeft className="h-6 w-6 text-white" />
            </div>
          </button>

          {/* Preload adjacent pages (pivot ± step). */}
          {pages[currentPage - 1] && (
            <link rel="preload" href={pages[currentPage - 1].url} as="image" />
          )}
          {pages[currentPage + step] && (
            <link
              rel="preload"
              href={pages[currentPage + step].url}
              as="image"
            />
          )}
          {prefs.doublePage && pages[currentPage + step + 1] && (
            <link
              rel="preload"
              href={pages[currentPage + step + 1].url}
              as="image"
            />
          )}
          <motion.div
            key={currentPage}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex h-full min-h-full w-full items-center justify-center gap-1 p-2"
          >
            {orderedSpread.map((p, i) => (
              <img
                key={p.filename}
                src={p.url}
                alt={`Page ${currentPage + 1 + i}`}
                className={`${
                  prefs.doublePage
                    ? "max-h-full w-auto max-w-[50%] object-contain"
                    : `${fitClass} object-contain`
                } select-none`}
                style={imgStyle}
                draggable={false}
              />
            ))}
          </motion.div>

          <button
            onClick={rightAction}
            disabled={rightDisabled}
            className="fixed right-0 top-0 bottom-0 w-1/4 z-10 flex items-center justify-end pr-4 transition-opacity opacity-0 hover:opacity-100 disabled:opacity-0"
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
          style={{ rowGap: prefs.pageGap }}
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
              style={imgStyle}
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

      {/* Page number — bottom right corner */}
      <div
        className={`fixed bottom-4 right-4 z-20 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <span
          className={`glass rounded-lg px-3 py-1.5 text-xs font-medium ${
            isLightBg ? "bg-black/60 text-white" : "text-white/80"
          }`}
        >
          {displayPage + 1}
          {prefs.doublePage &&
            mode === "paged" &&
            currentPage + 1 < total &&
            `-${displayPage + 2}`}{" "}
          / {total}
        </span>
      </div>

      {/* Right-click settings menu */}
      {menu && (
        <ReaderContextMenu
          x={menu.x}
          y={menu.y}
          mode={mode}
          fit={fit}
          prefs={prefs}
          showControls={!userHidden}
          currentPage={displayPage}
          totalPages={total}
          hasPrevChapter={!!prevChapter}
          hasNextChapter={!!nextChapter}
          onClose={() => setMenu(null)}
          onSetMode={(m) => setMangadexReaderMode(m)}
          onSetFit={(f) => setMangadexReaderFit(f)}
          onPatchPrefs={(patch) => setMangadexReaderPrefs(patch)}
          onToggleControls={() => setUserHidden((s) => !s)}
          onPrevPage={goPrev}
          onNextPage={goNext}
          onJumpTo={jumpTo}
          onPrevChapter={() => {
            if (prevChapter) navigate(`/mangadex/reader/${prevChapter.id}`, { replace: true });
          }}
          onNextChapter={() => {
            if (nextChapter) navigate(`/mangadex/reader/${nextChapter.id}`, { replace: true });
          }}
          onBack={goBackToMangaDetail}
        />
      )}
    </div>
  );
}
