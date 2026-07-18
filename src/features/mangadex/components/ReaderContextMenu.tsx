import { useEffect, useRef } from "react";
import {
  ScrollText,
  BookOpen,
  Maximize2,
  Minimize2,
  Move,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowLeft,
} from "lucide-react";

export type ReaderMode = "paged" | "scroll";
export type FitMode = "width" | "height" | "original";

interface ReaderContextMenuProps {
  x: number;
  y: number;
  mode: ReaderMode;
  fit: FitMode;
  showControls: boolean;
  currentPage: number;
  totalPages: number;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  onClose: () => void;
  onSetMode: (m: ReaderMode) => void;
  onSetFit: (f: FitMode) => void;
  onToggleControls: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpTo: (p: number) => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onBack: () => void;
}

/**
 * Right-click context menu for the manga reader, modelled on the options
 * advanced manga readers (Tachiyomi, Mihon, Komga) expose: reading mode,
 * page fit, page/chapter navigation, and UI toggles.
 */
export default function ReaderContextMenu({
  x,
  y,
  mode,
  fit,
  showControls,
  currentPage,
  totalPages,
  hasPrevChapter,
  hasNextChapter,
  onClose,
  onSetMode,
  onSetFit,
  onToggleControls,
  onPrevPage,
  onNextPage,
  onJumpTo,
  onPrevChapter,
  onNextChapter,
  onBack,
}: ReaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape / scroll.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Clamp the menu inside the viewport.
  const left = Math.min(x, window.innerWidth - 260);
  const top = Math.min(y, window.innerHeight - 420);

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-yuui-muted">
      {children}
    </p>
  );

  const Chip = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-all ${
        active
          ? "bg-yuui-accent text-white"
          : "bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12] hover:text-white"
      }`}
    >
      {children}
    </button>
  );

  return (
    <>
      {/* Backdrop to catch the first click without scrolling the reader */}
      <div
        className="fixed inset-0 z-40"
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        ref={menuRef}
        className="fixed z-50 w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-yuui-panel/95 backdrop-blur-xl shadow-2xl"
        style={{ left, top }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Reading mode */}
        <SectionLabel>Reading Mode</SectionLabel>
        <div className="px-3 flex gap-1.5">
          <Chip active={mode === "scroll"} onClick={() => onSetMode("scroll")}>
            <ScrollText className="h-3.5 w-3.5" /> Vertical
          </Chip>
          <Chip active={mode === "paged"} onClick={() => onSetMode("paged")}>
            <BookOpen className="h-3.5 w-3.5" /> Paged
          </Chip>
        </div>

        {/* Page fit */}
        <SectionLabel>Page Fit</SectionLabel>
        <div className="px-3 flex flex-wrap gap-1.5">
          <Chip active={fit === "width"} onClick={() => onSetFit("width")}>
            <Maximize2 className="h-3.5 w-3.5" /> Fit Width
          </Chip>
          <Chip active={fit === "height"} onClick={() => onSetFit("height")}>
            <Minimize2 className="h-3.5 w-3.5" /> Fit Height
          </Chip>
          <Chip
            active={fit === "original"}
            onClick={() => onSetFit("original")}
          >
            <Move className="h-3.5 w-3.5" /> Original
          </Chip>
        </div>

        {/* Page navigation */}
        <SectionLabel>
          Page {currentPage + 1} / {totalPages}
        </SectionLabel>
        <div className="px-3 flex items-center gap-2">
          <button
            onClick={onPrevPage}
            disabled={currentPage === 0}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12] hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, totalPages - 1)}
            value={currentPage}
            onChange={(e) => onJumpTo(Number(e.target.value))}
            className="flex-1 accent-yuui-accent"
          />
          <button
            onClick={onNextPage}
            disabled={currentPage >= totalPages - 1}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12] hover:text-white disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Chapter navigation */}
        <SectionLabel>Chapter</SectionLabel>
        <div className="px-3 flex gap-1.5">
          <button
            onClick={onPrevChapter}
            disabled={!hasPrevChapter}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-yuui-muted hover:bg-white/[0.12] hover:text-white disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            onClick={onNextChapter}
            disabled={!hasNextChapter}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-yuui-muted hover:bg-white/[0.12] hover:text-white disabled:opacity-30"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* UI toggles */}
        <SectionLabel>Interface</SectionLabel>
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <button
            onClick={onToggleControls}
            className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-yuui-muted hover:bg-white/[0.12] hover:text-white"
          >
            {showControls ? (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Hide Controls
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5" /> Show Controls
              </>
            )}
          </button>
          <button
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-semibold text-yuui-muted hover:bg-white/[0.12] hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Manga
          </button>
        </div>
      </div>
    </>
  );
}
