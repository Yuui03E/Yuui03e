import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  ArrowLeft,
  Pin,
  PinOff,
  RotateCcw,
  X,
} from "lucide-react";
import type {
  MangadexReaderAction,
  MangadexReaderFit,
  MangadexReaderMode,
  MangadexReaderPrefs,
} from "../../../store/types";
import { DEFAULT_READER_PREFS } from "../../../store/slices/mangadexSlice";

interface ReaderContextMenuProps {
  x: number;
  y: number;
  mode: MangadexReaderMode;
  fit: MangadexReaderFit;
  prefs: MangadexReaderPrefs;
  showControls: boolean;
  currentPage: number;
  totalPages: number;
  hasPrevChapter: boolean;
  hasNextChapter: boolean;
  onClose: () => void;
  onSetMode: (m: MangadexReaderMode) => void;
  onSetFit: (f: MangadexReaderFit) => void;
  onPatchPrefs: (patch: Partial<MangadexReaderPrefs>) => void;
  onToggleControls: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onJumpTo: (p: number) => void;
  onPrevChapter: () => void;
  onNextChapter: () => void;
  onBack: () => void;
}

/** Auto-hide delay presets (ms). */
const AUTO_HIDE_PRESETS = [
  { label: "0.25s", value: 250 },
  { label: "0.5s", value: 500 },
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "5s", value: 5000 },
];

/** Rebindable actions shown in the Keyboard Shortcuts section. */
const KEY_ACTIONS: { action: MangadexReaderAction; label: string }[] = [
  { action: "prevPage", label: "Previous page" },
  { action: "nextPage", label: "Next page" },
  { action: "scrollUp", label: "Scroll up" },
  { action: "scrollDown", label: "Scroll down" },
  { action: "prevChapter", label: "Previous chapter" },
  { action: "nextChapter", label: "Next chapter" },
  { action: "toggleMode", label: "Toggle mode" },
  { action: "cycleFit", label: "Cycle page fit" },
  { action: "toggleControls", label: "Hide/show controls" },
];

/** Pretty-print a stored `KeyboardEvent.key` value ("arrowleft" → "←"). */
function formatKey(key: string): string {
  const map: Record<string, string> = {
    arrowleft: "←",
    arrowright: "→",
    arrowup: "↑",
    arrowdown: "↓",
    " ": "Space",
    pageup: "PgUp",
    pagedown: "PgDn",
    home: "Home",
    end: "End",
  };
  return map[key] ?? key.toUpperCase();
}

/**
 * Right-click settings menu for the manga reader, modelled on the options
 * advanced manga readers (Tachiyomi, Mihon, Komga) expose: reading mode,
 * direction, page fit, resize algorithm, image quality, background, zoom,
 * brightness, page gap, double-page, page/chapter navigation and UI toggles.
 *
 * Two placements:
 *  - floating: opens at the cursor and auto-hides `prefs.menuAutoHideMs`
 *    after the pointer/focus leaves it (delay is user-configurable).
 *  - pinned ("always stay on top"): docked as a right-side panel that
 *    never auto-hides until unpinned or explicitly closed.
 */
export default function ReaderContextMenu({
  x,
  y,
  mode,
  fit,
  prefs,
  showControls,
  currentPage,
  totalPages,
  hasPrevChapter,
  hasNextChapter,
  onClose,
  onSetMode,
  onSetFit,
  onPatchPrefs,
  onToggleControls,
  onPrevPage,
  onNextPage,
  onJumpTo,
  onPrevChapter,
  onNextChapter,
  onBack,
}: ReaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | null>(null);
  const pinned = prefs.menuPinned;
  // Custom auto-hide delay text field ("" while user is typing).
  const [customDelay, setCustomDelay] = useState<string>("");
  // Action currently waiting for a key press to rebind (null = none).
  const [capturing, setCapturing] = useState<MangadexReaderAction | null>(null);

  // While capturing, grab the next key press (capture phase so it wins over
  // the reader's own shortcut handler) and store it as the new binding.
  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Ignore bare modifier presses; Escape cancels.
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      if (e.key !== "Escape") {
        onPatchPrefs({
          keys: { ...prefs.keys, [capturing]: e.key.toLowerCase() },
        });
      }
      setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [capturing, prefs.keys, onPatchPrefs]);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  // Auto-hide when the pointer / keyboard focus leaves the menu (unless pinned).
  const scheduleHide = useCallback(() => {
    if (pinned) return;
    cancelHide();
    hideTimer.current = window.setTimeout(
      onClose,
      Math.max(0, prefs.menuAutoHideMs),
    );
  }, [pinned, prefs.menuAutoHideMs, onClose, cancelHide]);

  // If the menu opens with the cursor outside it (e.g. keyboard), arm the timer.
  useEffect(() => {
    scheduleHide();
    return cancelHide;
  }, [scheduleHide, cancelHide]);

  // Close on outside click / Escape. A pinned panel ignores outside clicks
  // ("always stay on top") but can still be closed with Escape or its X.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (pinned) return;
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
  }, [onClose, pinned]);

  // Clamp the floating menu inside the viewport.
  const left = Math.min(x, window.innerWidth - 296);
  const top = Math.min(y, Math.max(8, window.innerHeight - 560));

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-yuui-muted">
      {children}
    </p>
  );

  const Chip = ({
    active,
    onClick,
    title,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    title?: string;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold capitalize transition-all ${
        active
          ? "bg-yuui-accent text-white"
          : "bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12] hover:text-white"
      }`}
    >
      {children}
    </button>
  );

  const SliderRow = ({
    label,
    value,
    min,
    max,
    step,
    suffix,
    onChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    suffix: string;
    onChange: (v: number) => void;
  }) => (
    <div className="px-3 flex items-center gap-2">
      <span className="w-16 shrink-0 text-[10px] font-semibold text-yuui-muted">
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-yuui-accent"
      />
      <span className="w-11 shrink-0 text-right text-[10px] tabular-nums text-white/70">
        {value}
        {suffix}
      </span>
    </div>
  );

  const body = (
    <>
      {/* Header: pin ("always stay on top") + close */}
      <div className="flex items-center justify-between px-3 pt-2.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-yuui-muted">
          Reader Settings
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPatchPrefs({ menuPinned: !pinned })}
            title={
              pinned
                ? "Unpin (float at cursor, auto-hide)"
                : "Always stay on top (dock to right side)"
            }
            className={`flex h-6 w-6 items-center justify-center rounded-lg transition-all ${
              pinned
                ? "bg-yuui-accent text-white"
                : "bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12] hover:text-white"
            }`}
          >
            {pinned ? (
              <Pin className="h-3.5 w-3.5" />
            ) : (
              <PinOff className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onClose}
            title="Close"
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12] hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Page navigation */}
      <SectionLabel>
        Page {currentPage + 1} / {totalPages}
      </SectionLabel>
      <div className="px-3 flex items-center gap-2">
        <button
          onClick={onPrevPage}
          disabled={currentPage === 0 && !hasPrevChapter}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12] hover:text-white disabled:opacity-30"
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
          disabled={currentPage >= totalPages - 1 && !hasNextChapter}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12] hover:text-white disabled:opacity-30"
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

      {/* Reading mode */}
      <SectionLabel>Reading Mode</SectionLabel>
      <div className="px-3 grid grid-cols-2 gap-1.5">
        <Chip active={mode === "paged"} onClick={() => onSetMode("paged")}>
          Paged
        </Chip>
        <Chip active={mode === "scroll"} onClick={() => onSetMode("scroll")}>
          Vertical
        </Chip>
      </div>

      {/* Direction (paged mode) */}
      {mode === "paged" && (
        <>
          <SectionLabel>Direction</SectionLabel>
          <div className="px-3 grid grid-cols-2 gap-1.5">
            <Chip
              active={prefs.direction === "ltr"}
              onClick={() => onPatchPrefs({ direction: "ltr" })}
              title="Left to right (western)"
            >
              LTR →
            </Chip>
            <Chip
              active={prefs.direction === "rtl"}
              onClick={() => onPatchPrefs({ direction: "rtl" })}
              title="Right to left (manga)"
            >
              ← RTL
            </Chip>
          </div>
        </>
      )}

      {/* Page fit */}
      <SectionLabel>Page Fit</SectionLabel>
      <div className="px-3 grid grid-cols-3 gap-1.5">
        {(["width", "height", "original"] as const).map((f) => (
          <Chip key={f} active={fit === f} onClick={() => onSetFit(f)}>
            {f === "width" ? "Width" : f === "height" ? "Height" : "Original"}
          </Chip>
        ))}
      </div>

      {/* Resize algorithm */}
      <SectionLabel>Resize Algorithm</SectionLabel>
      <div className="px-3 grid grid-cols-3 gap-1.5">
        <Chip
          active={prefs.quality === "best"}
          onClick={() => onPatchPrefs({ quality: "best" })}
          title="Smooth high-quality scaling"
        >
          Best
        </Chip>
        <Chip
          active={prefs.quality === "medium"}
          onClick={() => onPatchPrefs({ quality: "medium" })}
          title="Crisp edges — sharper lines, some aliasing"
        >
          Medium
        </Chip>
        <Chip
          active={prefs.quality === "fast"}
          onClick={() => onPatchPrefs({ quality: "fast" })}
          title="Nearest-neighbor — fastest, pixelated"
        >
          Fast
        </Chip>
      </div>

      {/* Image (CDN) quality */}
      <SectionLabel>Image Quality</SectionLabel>
      <div className="px-3 grid grid-cols-2 gap-1.5">
        <Chip
          active={prefs.imageQuality === "data"}
          onClick={() => onPatchPrefs({ imageQuality: "data" })}
          title="Original full-resolution scans from MangaDex"
        >
          High
        </Chip>
        <Chip
          active={prefs.imageQuality === "data-saver"}
          onClick={() => onPatchPrefs({ imageQuality: "data-saver" })}
          title="MangaDex's recompressed smaller files — less bandwidth, faster loads, slightly softer image"
        >
          Data Saver
        </Chip>
      </div>

      {/* Double page (paged mode) */}
      {mode === "paged" && (
        <>
          <SectionLabel>Layout</SectionLabel>
          <div className="px-3 grid grid-cols-2 gap-1.5">
            <Chip
              active={!prefs.doublePage}
              onClick={() => onPatchPrefs({ doublePage: false })}
            >
              Single
            </Chip>
            <Chip
              active={prefs.doublePage}
              onClick={() => onPatchPrefs({ doublePage: true })}
              title="Two-page spread"
            >
              Double
            </Chip>
          </div>
        </>
      )}

      {/* Background */}
      <SectionLabel>Background</SectionLabel>
      <div className="px-3 grid grid-cols-3 gap-1.5">
        {(["black", "gray", "white"] as const).map((b) => (
          <Chip
            key={b}
            active={prefs.background === b}
            onClick={() => onPatchPrefs({ background: b })}
          >
            {b}
          </Chip>
        ))}
      </div>

      {/* Display sliders */}
      <div className="flex items-center justify-between pr-3">
        <SectionLabel>Display</SectionLabel>
        {(prefs.zoom !== 100 ||
          prefs.brightness !== 100 ||
          prefs.pageGap !== 0) && (
          <button
            onClick={() =>
              onPatchPrefs({ zoom: 100, brightness: 100, pageGap: 0 })
            }
            title="Reset zoom, brightness and page gap to defaults"
            className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-yuui-muted transition-all hover:bg-white/[0.12] hover:text-white"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>
      <div className="flex flex-col gap-2 pb-1">
        <SliderRow
          label="Zoom"
          value={prefs.zoom}
          min={50}
          max={300}
          step={10}
          suffix="%"
          onChange={(v) => onPatchPrefs({ zoom: v })}
        />
        <SliderRow
          label="Brightness"
          value={prefs.brightness}
          min={30}
          max={130}
          step={5}
          suffix="%"
          onChange={(v) => onPatchPrefs({ brightness: v })}
        />
        {mode === "scroll" && (
          <SliderRow
            label="Page Gap"
            value={prefs.pageGap}
            min={0}
            max={64}
            step={4}
            suffix="px"
            onChange={(v) => onPatchPrefs({ pageGap: v })}
          />
        )}
      </div>

      {/* Auto-hide delay */}
      <SectionLabel>Menu Auto-Hide</SectionLabel>
      <div className="px-3 flex flex-wrap items-center gap-1.5">
        {AUTO_HIDE_PRESETS.map((p) => (
          <Chip
            key={p.value}
            active={prefs.menuAutoHideMs === p.value}
            onClick={() => onPatchPrefs({ menuAutoHideMs: p.value })}
          >
            {p.label}
          </Chip>
        ))}
        <input
          type="number"
          min={0}
          step={100}
          placeholder={`${prefs.menuAutoHideMs}`}
          value={customDelay}
          onChange={(e) => setCustomDelay(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = parseInt(customDelay, 10);
              if (!isNaN(v) && v >= 0) {
                onPatchPrefs({ menuAutoHideMs: v });
                setCustomDelay("");
              }
            }
          }}
          onBlur={() => {
            const v = parseInt(customDelay, 10);
            if (!isNaN(v) && v >= 0) {
              onPatchPrefs({ menuAutoHideMs: v });
            }
            setCustomDelay("");
          }}
          title="Custom delay in milliseconds (press Enter)"
          className="w-20 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[11px] text-white/90 outline-none [appearance:textfield] focus:border-yuui-accent/40 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span className="text-[10px] text-yuui-muted">ms</span>
      </div>
      {pinned && (
        <p className="px-3 pt-1 text-[10px] text-yuui-muted">
          Pinned — the panel stays on top and never auto-hides.
        </p>
      )}

      {/* Keyboard shortcuts — click a key to rebind */}
      <div className="flex items-center justify-between pr-3">
        <SectionLabel>Keyboard Shortcuts</SectionLabel>
        <button
          onClick={() =>
            onPatchPrefs({ keys: { ...DEFAULT_READER_PREFS.keys } })
          }
          title="Reset all shortcuts to defaults"
          className="flex items-center gap-1 rounded-lg bg-white/[0.06] px-2 py-1 text-[10px] font-semibold text-yuui-muted transition-all hover:bg-white/[0.12] hover:text-white"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>
      <div className="px-3 flex flex-col gap-1">
        {KEY_ACTIONS.map(({ action, label }) => (
          <div key={action} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-yuui-muted">{label}</span>
            <button
              onClick={() =>
                setCapturing((c) => (c === action ? null : action))
              }
              title="Click, then press the new key (Esc cancels)"
              className={`min-w-[52px] rounded-md px-2 py-1 text-[10px] font-bold tabular-nums transition-all ${
                capturing === action
                  ? "animate-pulse bg-yuui-accent text-white"
                  : "bg-white/[0.06] text-white/80 hover:bg-white/[0.12]"
              }`}
            >
              {capturing === action ? "Press…" : formatKey(prefs.keys[action])}
            </button>
          </div>
        ))}
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
    </>
  );

  if (pinned) {
    // Docked right-side panel: always on top, no backdrop, no auto-hide.
    return (
      <div
        ref={menuRef}
        className="fixed right-3 top-1/2 z-50 max-h-[92vh] w-72 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/[0.08] bg-yuui-panel/95 backdrop-blur-xl shadow-2xl"
        onContextMenu={(e) => e.preventDefault()}
      >
        {body}
      </div>
    );
  }

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
        tabIndex={-1}
        className="fixed z-50 max-h-[92vh] w-72 overflow-y-auto rounded-2xl border border-white/[0.08] bg-yuui-panel/95 backdrop-blur-xl shadow-2xl"
        style={{ left, top }}
        onContextMenu={(e) => e.preventDefault()}
        onMouseEnter={cancelHide}
        onMouseLeave={scheduleHide}
        onFocus={cancelHide}
        onBlur={(e) => {
          // Only schedule when focus leaves the menu entirely.
          if (!menuRef.current?.contains(e.relatedTarget as Node)) {
            scheduleHide();
          }
        }}
      >
        {body}
      </div>
    </>
  );
}
