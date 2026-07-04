import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";

// Check if running inside a real Tauri shell (not a plain browser)
const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function TitleBarControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;

    try {
      const win = getCurrentWindow();
      win.isMaximized().then(setIsMaximized).catch(() => {});
      win.onResized(() => {
        win.isMaximized().then(setIsMaximized).catch(() => {});
      }).then((fn) => { unlisten = fn; }).catch(() => {});
    } catch {
      // Tauri IPC not ready yet — safe to ignore
    }

    return () => { unlisten?.(); };
  }, []);

  const handleMinimize = () => {
    if (!isTauri()) return;
    try { getCurrentWindow().minimize(); } catch {}
  };

  const handleMaximize = () => {
    if (!isTauri()) return;
    try { getCurrentWindow().toggleMaximize(); } catch {}
  };

  const handleClose = () => {
    if (!isTauri()) return;
    try { getCurrentWindow().close(); } catch {}
  };

  return (
    <div className="flex h-full items-center no-drag z-50" data-tauri-drag-region="false">
      {/* Minimize */}
      <button
        onClick={handleMinimize}
        className="flex h-full w-[46px] items-center justify-center text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors duration-150 no-drag focus:outline-none"
        title="Minimize"
        data-tauri-drag-region="false"
      >
        <Minus className="h-4 w-4" />
      </button>

      {/* Maximize / Restore */}
      <button
        onClick={handleMaximize}
        className="flex h-full w-[46px] items-center justify-center text-muted-foreground hover:bg-surface-elevated hover:text-foreground transition-colors duration-150 no-drag focus:outline-none"
        title={isMaximized ? "Restore" : "Maximize"}
        data-tauri-drag-region="false"
      >
        {isMaximized ? (
          <Copy className="h-[14px] w-[14px]" />
        ) : (
          <Square className="h-[14px] w-[14px]" />
        )}
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className="flex h-full w-[46px] items-center justify-center text-muted-foreground hover:bg-[#e81123] hover:text-white transition-colors duration-150 no-drag focus:outline-none"
        title="Close"
        data-tauri-drag-region="false"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
