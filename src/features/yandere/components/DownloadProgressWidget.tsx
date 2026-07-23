import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, CheckCircle2, AlertCircle, ChevronUp, ChevronDown, FolderOpen, X, Sparkles } from "lucide-react";
import { listen } from "@tauri-apps/api/event";

export interface DownloadProgressPayload {
  id: string;
  filename: string;
  bytes_downloaded: number;
  total_bytes: number;
  percent: number;
  status: "downloading" | "completed" | "error";
  save_path?: string;
  error_msg?: string;
}

export default function DownloadProgressWidget() {
  const [downloads, setDownloads] = useState<Record<string, DownloadProgressPayload>>({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unlisten = await listen<DownloadProgressPayload>("download-progress", (event) => {
          const item = event.payload;
          setDownloads((prev) => ({
            ...prev,
            [item.id]: item,
          }));

          if (item.status === "completed" || item.status === "error") {
            setTimeout(() => {
              setDownloads((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
              });
            }, 6000);
          }
        });
      } catch {
        // Non-Tauri fallback
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const downloadList = Object.values(downloads);
  if (downloadList.length === 0) return null;

  const activeCount = downloadList.filter((d) => d.status === "downloading").length;
  const completedCount = downloadList.filter((d) => d.status === "completed").length;
  const latestItem = downloadList[downloadList.length - 1];

  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-6 right-6 z-[100] w-80 sm:w-96 rounded-[22px] border border-white/15 bg-black/90 p-3.5 shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl text-foreground font-sans"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 select-none">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent border border-accent/30 shadow-md">
              {activeCount > 0 ? (
                <Download className="h-4 w-4 animate-bounce text-accent" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white truncate">
                  {downloadList.length === 1
                    ? latestItem.filename
                    : `Downloading Artworks (${activeCount} active)`}
                </span>
              </div>
              <p className="text-[10px] text-yuui-muted truncate font-medium">
                {downloadList.length === 1
                  ? latestItem.status === "completed"
                    ? "Download complete!"
                    : latestItem.status === "error"
                    ? "Download failed"
                    : `${latestItem.percent}% • ${formatSize(latestItem.bytes_downloaded)}`
                  : `${completedCount}/${downloadList.length} completed`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isExpanded ? "Collapse view" : "Expand download list"}
            >
              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setDownloads({})}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 hover:bg-rose-500/20 text-yuui-muted hover:text-rose-400 transition-colors cursor-pointer"
              title="Close all notifications"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Compact Single Item Progress Bar (if collapsed) */}
        {!isExpanded && latestItem && (
          <div className="mt-2.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={`h-full transition-all duration-200 ${
                  latestItem.status === "completed"
                    ? "bg-emerald-500"
                    : latestItem.status === "error"
                    ? "bg-rose-500"
                    : "bg-accent"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${latestItem.status === "completed" ? 100 : latestItem.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Expanded Scrollable Multi-Download List */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden pt-3 mt-3 border-t border-white/10"
            >
              <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 scrollbar-none">
                {downloadList.map((item) => {
                  const isDone = item.status === "completed";
                  const isErr = item.status === "error";
                  return (
                    <div
                      key={item.id}
                      className="rounded-xl bg-white/[0.04] p-2.5 border border-white/[0.08] flex flex-col gap-1.5 transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isDone ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                          ) : isErr ? (
                            <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-accent animate-pulse shrink-0" />
                          )}
                          <span className="truncate text-xs font-semibold text-white font-mono" title={item.filename}>
                            {item.filename}
                          </span>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono shrink-0 ${
                            isDone
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : isErr
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                              : "bg-accent/20 text-accent border border-accent/30"
                          }`}
                        >
                          {isDone ? "100%" : isErr ? "Error" : `${item.percent}%`}
                        </span>
                      </div>

                      {/* Item Progress Bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className={`h-full transition-all duration-200 ${
                            isDone ? "bg-emerald-500" : isErr ? "bg-rose-500" : "bg-accent"
                          }`}
                          style={{ width: `${isDone ? 100 : item.percent}%` }}
                        />
                      </div>

                      {/* Saved Location or Error message */}
                      {item.save_path && (
                        <div className="flex items-center gap-1.5 text-[10px] text-yuui-muted font-mono truncate pt-0.5">
                          <FolderOpen className="h-3 w-3 shrink-0 text-accent/80" />
                          <span className="truncate" title={item.save_path}>
                            {item.save_path}
                          </span>
                        </div>
                      )}
                      {item.error_msg && (
                        <p className="text-[10px] text-rose-400 font-mono pt-0.5">
                          {item.error_msg}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
