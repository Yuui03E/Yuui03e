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

      {/* Spacer to push controls to the right */}
      <div className="flex-1" />

      {/* Control Buttons */}
      <div className="relative z-10 flex h-full items-center pointer-events-auto">
        <TitleBarControls />
      </div>
    </div>
  );
}
