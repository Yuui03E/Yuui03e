import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";

export default function TitleBarControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    
    // Check initial maximized state
    win.isMaximized().then(setIsMaximized);

    // Listen to resize to update maximized state
    const unlistenPromise = win.onResized(() => {
      win.isMaximized().then(setIsMaximized);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  const handleMinimize = () => {
    getCurrentWindow().minimize();
  };

  const handleMaximize = () => {
    getCurrentWindow().toggleMaximize();
  };

  const handleClose = () => {
    getCurrentWindow().close();
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
