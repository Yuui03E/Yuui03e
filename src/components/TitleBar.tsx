import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import TitleBarControls from "./TitleBarControls";

export default function TitleBar() {
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      getCurrentWebviewWindow().startDragging();
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex h-10 select-none items-center justify-between bg-transparent text-foreground cursor-default w-full pointer-events-none">
      {/* Draggable Background Sibling */}
      <div
        data-tauri-drag-region
        onMouseDown={handleMouseDown}
        className="drag-region absolute inset-0 z-0 h-full w-full pointer-events-auto"
      />

      {/* Page slot: routed pages portal contextual content here (e.g. the
          manga reader's Back button + title) so it renders INSIDE the window
          title bar, above the drag region — same layering trick as the
          window controls. The slot itself stays pointer-events-none so empty
          space still drags; interactive children opt back in with
          pointer-events-auto + no-drag. */}
      <div
        id="titlebar-slot"
        className="relative z-10 flex h-full min-w-0 flex-1 items-center pointer-events-none"
      />

      {/* Control Buttons */}
      <div className="relative z-10 flex h-full items-center pointer-events-auto">
        <TitleBarControls />
      </div>
    </div>
  );
}
