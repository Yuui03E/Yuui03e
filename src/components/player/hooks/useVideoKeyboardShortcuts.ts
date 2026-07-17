import { useEffect, useRef } from "react";

export function useVideoKeyboardShortcuts({
  togglePlay,
  onClose,
  toggleFullscreen,
  toggleMute,
  videoRef,
  setVolume,
  setMuted,
}: any) {
  // Keyboard shortcut controls. All callbacks close over component state, so
  // each is read through a ref kept current every render — the `[]`-dep
  // listener below would otherwise capture the first-render (stale) versions.
  const togglePlayRef = useRef(togglePlay);
  togglePlayRef.current = togglePlay;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const toggleFullscreenRef = useRef(toggleFullscreen);
  toggleFullscreenRef.current = toggleFullscreen;
  const toggleMuteRef = useRef(toggleMute);
  toggleMuteRef.current = toggleMute;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        togglePlayRef.current();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      } else if (e.key === "ArrowRight") {
        if (videoRef.current) videoRef.current.currentTime += 10;
      } else if (e.key === "ArrowLeft") {
        if (videoRef.current) videoRef.current.currentTime -= 10;
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        toggleFullscreenRef.current();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        toggleMuteRef.current();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (videoRef.current) {
          const nextVol = Math.min(1, videoRef.current.volume + 0.05);
          videoRef.current.volume = nextVol;
          setVolume(nextVol);
          setMuted(nextVol === 0);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (videoRef.current) {
          const nextVol = Math.max(0, videoRef.current.volume - 0.05);
          videoRef.current.volume = nextVol;
          setVolume(nextVol);
          setMuted(nextVol === 0);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
