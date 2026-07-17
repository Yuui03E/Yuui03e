// Sync control — cancel, pause, resume an ongoing sync.
import { invoke } from "@tauri-apps/api/core";

/** Cancel an ongoing sync. Current series finishes, then matching stops. */
export async function cancelSync(): Promise<void> {
  return invoke("cancel_sync");
}

/** Pause an ongoing sync. Current series finishes, then matching pauses. */
export async function pauseSync(): Promise<void> {
  return invoke("pause_sync");
}

/** Resume a paused sync. */
export async function resumeSync(): Promise<void> {
  return invoke("resume_sync");
}
