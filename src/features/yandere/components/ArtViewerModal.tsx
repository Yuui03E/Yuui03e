import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Heart,
  Download,
  ExternalLink,
  Tag,
  Check,

  ChevronLeft,
  ChevronRight,
  Globe,
  FileType,
  Ruler,
  Star,
  User,
  Calendar,
  HardDrive,
  Pin,
  PinOff,
  Link as LinkIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Clock,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import type { YandePost } from "../../../lib/yandereApi";
import { useLibrary } from "../../../store/library";
import { downloadYandeImage } from "../../../lib/yandereApi";
import type { DownloadProgressPayload } from "./DownloadProgressWidget";

interface ArtViewerModalProps {
  post: YandePost | null;
  onClose: () => void;
  onSelectTag: (tag: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSourceDomain(url: string) {
  if (!url) return "None";
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.length > 20 ? url.substring(0, 20) + "..." : url;
  }
}

export default function ArtViewerModal({
  post,
  onClose,
  onSelectTag,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: ArtViewerModalProps) {
  const {
    yandereDownloadDir,
    yandereFavorites,
    toggleYandereFavorite,
    setToastMsg,
  } = useLibrary();

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panBase = useRef({ x: 0, y: 0 });

  const [copiedImage, setCopiedImage] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Default pinned to top right
  const [panelOpen, setPanelOpen] = useState(true);
  const [pinned, setPinned] = useState(true);
  const [autoHideDelay, setAutoHideDelay] = useState(3500); // 1s, 2s, 3.5s, 5s
  const [quality, setQuality] = useState<"sample" | "original">("original");

  // Track download progress for this post
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressPayload | null>(null);

  // Auto-hide controls when unpinned
  const [dockVisible, setDockVisible] = useState(true);
  const hideRef = useRef<number | null>(null);
  const resetDock = useCallback(() => {
    setDockVisible(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = window.setTimeout(() => {
      if (!pinned) setDockVisible(false);
    }, autoHideDelay);
  }, [pinned, autoHideDelay]);

  useEffect(() => {
    resetDock();
    const m = () => resetDock();
    window.addEventListener("mousemove", m);
    return () => {
      window.removeEventListener("mousemove", m);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, [resetDock]);

  // When pinned, keep controls visible
  useEffect(() => {
    if (pinned) setDockVisible(true);
  }, [pinned]);

  // Reset modal state on post change
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCopiedImage(false);
    setDownloadProgress(null);
  }, [post]);

  // Listen to Tauri live download progress events
  useEffect(() => {
    if (!post) return;
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen<DownloadProgressPayload>("download-progress", (event) => {
          const item = event.payload;
          if (item.id === String(post.id)) {
            setDownloadProgress(item);
            if (item.status === "completed" || item.status === "error") {
              setTimeout(() => setDownloadProgress(null), 5000);
            }
          }
        });
      } catch {
        // Fallback for non-Tauri environment
      }
    };

    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, [post]);

  const doDownload = useCallback(async () => {
    if (!post) return;
    const url = quality === "original" ? post.file_url : (post.sample_url || post.file_url);
    const fn = `yuui_yande_${post.id}_${quality}.${post.file_ext || "jpg"}`;
    try {
      setDownloading(true);
      await downloadYandeImage(String(post.id), url, fn, yandereDownloadDir);
    } catch {
      setToastMsg("Download failed!");
    } finally {
      setDownloading(false);
    }
  }, [post, quality, yandereDownloadDir, setToastMsg]);

  // Copy artwork image binary to system clipboard
  const doCopyArtworkImage = useCallback(async () => {
    if (!post) return;
    const targetUrl = quality === "original" ? post.file_url : (post.sample_url || post.file_url);
    try {
      const res = await fetch(targetUrl);
      const blob = await res.blob();

      // Convert image to PNG blob if needed for standard system clipboard compatibility
      let pngBlob = blob;
      if (blob.type !== "image/png") {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const loadedBlob = await new Promise<Blob>((resolve, reject) => {
          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(img, 0, 0);
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas export failed"))), "image/png");
          };
          img.onerror = reject;
          img.src = URL.createObjectURL(blob);
        });
        pngBlob = loadedBlob;
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          [pngBlob.type]: pngBlob,
        }),
      ]);

      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
      setToastMsg("Copied artwork image to clipboard!");
    } catch {
      // Fallback: Copy URL text if blob clipboard API is restricted
      navigator.clipboard.writeText(`https://yande.re/post/show/${post.id}`);
      setToastMsg("Copied post link to clipboard!");
    }
  }, [post, quality, setToastMsg]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!post) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "Escape": panelOpen ? setPanelOpen(false) : onClose(); break;
        case "ArrowLeft": case "a": case "A": if (hasPrev && onPrev) onPrev(); break;
        case "ArrowRight": case "d": case "D": if (hasNext && onNext) onNext(); break;
        case "i": case "I": setPanelOpen((p) => !p); break;
        case "f": case "F": toggleYandereFavorite(post); break;
        case "+": case "=": setZoom((z) => Math.min(5, z + 0.25)); break;
        case "-": setZoom((z) => Math.max(0.25, z - 0.25)); break;
        case "0": setZoom(1); setPan({ x: 0, y: 0 }); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [post, hasPrev, hasNext, onPrev, onNext, onClose, toggleYandereFavorite, panelOpen]);

  // Mouse wheel zoom
  useEffect(() => {
    const w = (e: WheelEvent) => {
      if (!post) return;
      e.preventDefault();
      setZoom((z) => Math.max(0.25, Math.min(5, z - e.deltaY * 0.0015)));
    };
    window.addEventListener("wheel", w, { passive: false });
    return () => window.removeEventListener("wheel", w);
  }, [post]);

  // Pan
  const pDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY };
    panBase.current = { ...pan };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const pMove = (e: React.PointerEvent) => {
    if (!isPanning) return;
    setPan({
      x: panBase.current.x + (e.clientX - panStart.current.x),
      y: panBase.current.y + (e.clientY - panStart.current.y),
    });
  };
  const pUp = () => setIsPanning(false);

  if (!post) return null;

  const isFav = yandereFavorites.some((f) => f.id === post.id);
  const tags = post.tags.split(" ").filter(Boolean);
  const postUrl = `https://yande.re/post/show/${post.id}`;
  const imgSrc = quality === "original" ? post.file_url : (post.sample_url || post.file_url);
  const targetWidth = quality === "original" ? post.width : (post.sample_width || post.width);
  const targetHeight = quality === "original" ? post.height : (post.sample_height || post.height);

  const showControls = dockVisible || panelOpen || pinned;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className="fixed inset-0 z-[120] flex bg-black overflow-hidden font-sans select-none"
      >
        {/* ═══════ IMAGE CANVAS ═══════ */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden"
          onPointerDown={pDown}
          onPointerMove={pMove}
          onPointerUp={pUp}
          style={{ cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default" }}
        >
          <motion.img
            key={`${post.id}-${quality}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            src={imgSrc}
            alt={`#${post.id}`}
            referrerPolicy="no-referrer"
            draggable={false}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: isPanning ? "none" : "transform 0.15s ease-out",
            }}
            className="max-h-[96vh] max-w-full object-contain select-none"
          />

          {/* Top-left Floating Bar: Close Button Only (Left top details toggle permanently removed) */}
          <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
            <button
              onClick={onClose}
              title="Close (Esc)"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/40 hover:text-white hover:bg-white/[0.12] transition-all cursor-pointer backdrop-blur-md border border-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Nav Arrows */}
          <AnimatePresence>
            {hasPrev && showControls && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onPrev} title="Previous (← / A)"
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-black/60 border border-white/10 text-white/40 backdrop-blur-md hover:bg-white/10 hover:text-white hover:scale-105 transition-all cursor-pointer shadow-xl"
              >
                <ChevronLeft className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {hasNext && showControls && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onNext} title="Next (→ / D)"
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-black/60 border border-white/10 text-white/40 backdrop-blur-md hover:bg-white/10 hover:text-white hover:scale-105 transition-all cursor-pointer shadow-xl"
              >
                <ChevronRight className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ═══════ TOP-RIGHT DETAILS PANEL (Pinned by Default) ═══════ */}
        <AnimatePresence>
          {panelOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ type: "spring", stiffness: 450, damping: 35 }}
              className="absolute top-4 right-4 z-50 w-[260px] max-h-[88vh] border border-white/10 bg-black/95 backdrop-blur-2xl rounded-2xl overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.02] shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold text-white/50 uppercase tracking-widest">Details</span>
                  <span className="text-[8px] font-mono text-white/30 bg-white/5 px-1 py-0.2 rounded">#{post.id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPinned(!pinned)}
                    title={pinned ? "Unpin — panel will auto-hide with controls" : "Pin — stays visible"}
                    className={`flex h-5 w-5 items-center justify-center rounded transition-all cursor-pointer ${
                      pinned ? "bg-accent text-white shadow-sm" : "bg-white/5 text-white/30 hover:text-white hover:bg-white/10"
                    }`}>
                    {pinned ? <Pin className="h-2.5 w-2.5" /> : <PinOff className="h-2.5 w-2.5" />}
                  </button>
                  <button onClick={() => setPanelOpen(false)} title="Close panel"
                    className="flex h-5 w-5 items-center justify-center rounded bg-white/5 text-white/30 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-2.5 scrollbar-none">

                {/* ── ACTIONS ROW ── */}
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleYandereFavorite(post)} title="Favorite (F)"
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all cursor-pointer ${
                      isFav
                        ? "text-rose-400 bg-rose-500/15 border-rose-500/30"
                        : "text-white/40 bg-white/5 border-white/10 hover:text-rose-400 hover:bg-white/10"
                    }`}>
                    <Heart className={`h-3 w-3 ${isFav ? "fill-current" : ""}`} />
                  </button>

                  {/* COPY ARTWORK IMAGE TO CLIPBOARD BUTTON */}
                  <button onClick={doCopyArtworkImage} title="Copy artwork image to clipboard"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                    {copiedImage ? <Check className="h-3 w-3 text-emerald-400" /> : <ImageIcon className="h-3 w-3" />}
                  </button>

                  <a href={postUrl} target="_blank" rel="noopener noreferrer" title="Open on yande.re"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition-all cursor-pointer">
                    <ExternalLink className="h-3 w-3" />
                  </a>

                  {/* DOWNLOAD BUTTON SHOWING RESOLUTION (3840×2160) */}
                  <button onClick={doDownload} disabled={downloading} title={`Download (${targetWidth}×${targetHeight})`}
                    className="flex-1 flex h-7 items-center justify-center gap-1 rounded-lg bg-accent hover:bg-accent/90 text-white text-[9px] font-bold transition-all cursor-pointer disabled:opacity-50 shadow-sm truncate px-2">
                    <Download className="h-3 w-3 shrink-0" />
                    <span className="truncate">{downloading ? "Saving…" : `Download (${targetWidth}×${targetHeight})`}</span>
                  </button>
                </div>

                {/* ── LIVE DOWNLOAD PROGRESS BAR (Inside details panel if pinned) ── */}
                {pinned && downloadProgress && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-2 rounded-xl bg-accent/10 border border-accent/30 space-y-1"
                  >
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className="text-white/80 font-semibold truncate flex items-center gap-1">
                        {downloadProgress.status === "downloading" ? (
                          <Loader2 className="h-2.5 w-2.5 animate-spin text-accent" />
                        ) : downloadProgress.status === "completed" ? (
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="h-2.5 w-2.5 text-rose-400" />
                        )}
                        {downloadProgress.status === "downloading" ? "Downloading..." : downloadProgress.status === "completed" ? "Saved to Disk" : "Failed"}
                      </span>
                      <span className="text-accent font-bold">{downloadProgress.percent}%</span>
                    </div>

                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          downloadProgress.status === "completed"
                            ? "bg-emerald-400"
                            : downloadProgress.status === "error"
                            ? "bg-rose-500"
                            : "bg-accent"
                        }`}
                        style={{ width: `${downloadProgress.percent}%` }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* ── METADATA GRID (2-Column Cards) ── */}
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Metadata</span>
                    <span className={`text-[7.5px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                      post.rating === "s" ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                        : post.rating === "q" ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          : "text-rose-400 bg-rose-500/10 border-rose-500/20"
                    }`}>
                      {post.rating === "s" ? "Safe" : post.rating === "q" ? "Quest" : "Explicit"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { icon: User, label: "Artist", val: post.author || "Unknown" },
                      { icon: Calendar, label: "Date", val: fmtDate(post.created_at) },
                      { icon: Ruler, label: "Res", val: `${post.width}×${post.height}` },
                      { icon: HardDrive, label: "Size", val: fmtBytes(post.file_size) },
                      { icon: FileType, label: "Fmt", val: (post.file_ext || "jpg").toUpperCase() },
                      { icon: Star, label: "Score", val: String(post.score) },
                    ].map((item) => (
                      <div key={item.label} className="px-1.5 py-1 rounded-lg bg-white/[0.03] border border-white/5">
                        <span className="text-[7.5px] font-bold uppercase tracking-wider text-white/30 flex items-center gap-1">
                          <item.icon className="h-2 w-2 text-accent" />
                          {item.label}
                        </span>
                        <span className="text-[9.5px] font-semibold text-white/80 font-mono block truncate mt-0.5">
                          {item.val}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── EXPLICIT SOURCE SECTION ── */}
                <section>
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block mb-1">Source</span>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.03] border border-white/5 p-1.5">
                    <LinkIcon className="h-3 w-3 text-accent shrink-0" />
                    {post.source ? (
                      <a
                        href={post.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8.5px] font-mono text-accent hover:underline truncate flex-1 font-semibold"
                        title={post.source}
                      >
                        {getSourceDomain(post.source)}
                      </a>
                    ) : (
                      <span className="text-[8.5px] font-mono text-white/30 flex-1">None / Unknown</span>
                    )}
                    {post.source && (
                      <a
                        href={post.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/40 hover:text-white p-0.5 rounded"
                        title="Open Source Link"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </section>

                {/* ── QUALITY MODE ── */}
                <section>
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block mb-1">Quality Mode</span>
                  <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/5">
                    {[
                      { k: "sample" as const, label: "Sample", sub: `${post.sample_width || 1500}px` },
                      { k: "original" as const, label: "Original", sub: `${post.width}px` },
                    ].map((q) => (
                      <button key={q.k} onClick={() => setQuality(q.k)}
                        className={`py-1 px-1.5 rounded text-center transition-all cursor-pointer ${
                          quality === q.k
                            ? "bg-white/10 text-white font-bold shadow-xs border border-white/10"
                            : "text-white/40 hover:text-white/70"
                        }`}>
                        <span className="text-[9px] font-semibold block leading-tight">{q.label}</span>
                        <span className="text-[7.5px] font-mono text-white/30 leading-tight block">{q.sub}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* ── MENU AUTO-HIDE TIMEOUT SELECTOR ── */}
                <section>
                  <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-white/30 mb-1">
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5 text-accent" /> Auto-Hide Delay
                    </span>
                    <span className="font-mono text-accent font-bold">{(autoHideDelay / 1000).toFixed(1)}s</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/5">
                    {[1000, 2000, 3500, 5000].map((ms) => (
                      <button
                        key={ms}
                        onClick={() => setAutoHideDelay(ms)}
                        title={`Auto-hide UI after ${ms / 1000}s idle`}
                        className={`py-1 rounded text-center text-[8px] font-mono transition-all cursor-pointer ${
                          autoHideDelay === ms
                            ? "bg-white/10 text-white font-bold border border-white/10 shadow-xs"
                            : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        {(ms / 1000).toFixed(ms === 3500 ? 1 : 0)}s
                      </button>
                    ))}
                  </div>
                </section>

                {/* ── DISPLAY ZOOM ── */}
                <section>
                  <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-white/30 mb-0.5">
                    <span>Display Zoom</span>
                    <span className="font-mono text-accent font-bold">{Math.round(zoom * 100)}%</span>
                  </div>
                  <input type="range" min="25" max="500" step="5" value={Math.round(zoom * 100)}
                    onChange={(e) => { setZoom(parseInt(e.target.value) / 100); setPan({ x: 0, y: 0 }); }}
                    className="w-full accent-accent cursor-pointer h-1 bg-white/10 rounded-md" />
                </section>

                {/* ── DIRECT YANDE.RE LINK ── */}
                <section>
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest block mb-1">Yande.re Post Link</span>
                  <div className="flex items-center gap-1 rounded-lg bg-white/[0.03] border border-white/5 px-2 py-1">
                    <Globe className="h-2.5 w-2.5 text-accent shrink-0" />
                    <a href={postUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[8.5px] font-mono text-white/60 hover:text-white truncate flex-1 transition-colors">
                      yande.re/post/show/{post.id}
                    </a>
                  </div>
                </section>

                {/* ── TAGS ── */}
                <section>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-black text-white/30 uppercase tracking-widest flex items-center gap-1">
                      <Tag className="h-2.5 w-2.5 text-accent" /> Tags ({tags.length})
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-0.5 max-h-36 overflow-y-auto scrollbar-none">
                    {tags.map((t) => (
                      <button key={t} onClick={() => { onSelectTag(t); onClose(); }}
                        className="px-1.5 py-0.2 text-[8px] font-mono rounded bg-white/[0.04] text-white/60 border border-white/5 hover:border-accent/40 hover:text-accent transition-all cursor-pointer">
                        #{t}
                      </button>
                    ))}
                  </div>
                </section>

                <p className="text-[7.5px] text-white/20 text-center font-mono pt-0.5">
                  {pinned ? "Pinned — stays visible" : "Unpinned — auto-hides with controls"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
