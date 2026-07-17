import { useState, useEffect, useCallback, useRef } from "react";
import { useLibrary } from "../../store/library";
import { saveMediaListEntry } from "../../lib/api";

/**
 * Shared hook for the Quick Edit panel (status, progress, score, notes, fav).
 * Used by QuickViewModal, EntryDetailModal, and ProfileSidebar.
 *
 * Syncs local state whenever `syncKey` changes, then `handleSave` persists
 * locally AND mirrors to AniList (fix: QuickViewModal previously did not mirror).
 *
 * FIX R5: Uses refs to avoid stale closures in handleSave callback.
 * FIX R6: Uses a mutex to prevent race conditions on rapid save clicks.
 */
export function useQuickEdit({
  syncKey,
  getUserData,
  entryKey,
  mediaId,
}: {
  /** Key that changes when selection changes (e.g. entry.key, selectedKey). */
  syncKey: string | number | null | undefined;
  /** Getter for the current user-data snapshot (called inside the sync effect). */
  getUserData: () =>
    | {
        status?: string | null;
        progress?: number | null;
        score?: number | null;
        notes?: string | null;
        favorite?: boolean | null;
      }
    | null
    | undefined;
  /** Local DB entry key to persist user data under. Null = save disabled. */
  entryKey: string | null;
  /** Optional AniList media id for mirroring (pass null/undefined to skip). */
  mediaId?: number | null;
}) {
  const saveUserData = useLibrary((s) => s.saveUserData);

  const [editStatus, setEditStatus] = useState("Watching");
  const [editProgress, setEditProgress] = useState(0);
  const [editScore, setEditScore] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editFav, setEditFav] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Refs to hold latest values — avoids stale closures in handleSave (Fix R5)
  const editStatusRef = useRef(editStatus);
  const editProgressRef = useRef(editProgress);
  const editScoreRef = useRef(editScore);
  const editNotesRef = useRef(editNotes);
  const editFavRef = useRef(editFav);

  // Mutex for race condition prevention (Fix R6)
  const saveMutex = useRef<Promise<void>>(Promise.resolve());

  // Keep refs in sync with state
  editStatusRef.current = editStatus;
  editProgressRef.current = editProgress;
  editScoreRef.current = editScore;
  editNotesRef.current = editNotes;
  editFavRef.current = editFav;

  // Sync local edit state when the selection changes.
  useEffect(() => {
    const u = getUserData();
    if (u) {
      setEditStatus(
        !u.status || u.status === "Untracked" ? "Watching" : u.status,
      );
      setEditProgress(u.progress ?? 0);
      setEditScore(u.score ?? 0);
      setEditNotes(u.notes ?? "");
      setEditFav(u.favorite ?? false);
      setJustSaved(false);
    }
  }, [syncKey]);

  const handleSave = useCallback(async () => {
    if (!entryKey) return;

    // Chain onto the mutex to serialize saves (Fix R6)
    saveMutex.current = saveMutex.current.then(async () => {
      setIsSaving(true);
      try {
        // Use refs to get the latest values (avoid stale closure)
        const currentEditProgress = editProgressRef.current;
        const currentEditStatus = editStatusRef.current;
        const currentEditScore = editScoreRef.current;
        const currentEditNotes = editNotesRef.current;
        const currentEditFav = editFavRef.current;

        await saveUserData(entryKey, {
          progress: currentEditProgress,
          status: currentEditStatus,
          score: currentEditScore,
          notes: currentEditNotes,
          favorite: currentEditFav,
        });

        // Mirror to AniList (QuickViewModal did not do this before)
        if (mediaId) {
          await saveMediaListEntry({
            mediaId,
            progress: currentEditProgress,
            status: currentEditStatus,
            score: currentEditScore,
          });
        }

        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 1800);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSaving(false);
      }
    });

    // We don't await here to keep handleSave non-blocking for the caller,
    // but the mutex ensures sequential execution.
  }, [entryKey, mediaId, saveUserData]);

  return {
    editStatus,
    setEditStatus,
    editProgress,
    setEditProgress,
    editScore,
    setEditScore,
    editNotes,
    setEditNotes,
    editFav,
    setEditFav,
    isSaving,
    justSaved,
    handleSave,
  } as const;
}
