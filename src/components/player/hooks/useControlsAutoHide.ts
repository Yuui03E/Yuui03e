import { useEffect, useRef, useState } from "react";

export function useControlsAutoHide(videoRef: any, playing: boolean) {
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);

  // Handle controls visibility timer
  const resetControlsTimeout = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      const isPaused = videoRef.current ? videoRef.current.paused : true;
      if (!isPaused) {
        setShowControls(false);
      }
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        window.clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [playing]);

  return { showControls, resetControlsTimeout };
}
