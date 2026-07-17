import { useEffect, useState } from "react";
import type { StoredEntry, UserData } from "../../../lib/types";
import { Section } from "../components/Section";

export function NotesSection({
  entry: _entry,
  user,
  setEntry: _setEntry,
  update,
}: {
  entry: StoredEntry;
  user: UserData;
  setEntry: React.Dispatch<React.SetStateAction<StoredEntry | null>>;
  update: (patch: Partial<UserData>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(user.notes ?? "");

  useEffect(() => {
    setNotes(user.notes ?? "");
  }, [user.notes]);

  const handleBlur = () => {
    update({ notes: notes || null }).catch((err) => {
      console.error("Failed to save notes on blur:", err);
    });
  };

  return (
    <Section title="Notes">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="Private notes about this series…"
        className="glass min-h-[100px] w-full max-w-3xl rounded-2xl bg-transparent p-4 text-sm outline-none placeholder:text-yuui-muted"
      />
    </Section>
  );
}
