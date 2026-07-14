import type { StoredEntry, UserData } from "../../../lib/types";
import { Section } from "../components/Section";

export function NotesSection({
  entry,
  user,
  setEntry,
  update,
}: {
  entry: StoredEntry;
  user: UserData;
  setEntry: React.Dispatch<React.SetStateAction<StoredEntry | null>>;
  update: (patch: Partial<UserData>) => Promise<void>;
}) {
  return (
    <Section title="Notes">
      <textarea
        value={user.notes ?? ""}
        onChange={(e) =>
          setEntry({ ...entry, user: { ...user, notes: e.target.value } })
        }
        onBlur={(e) => update({ notes: e.target.value || null })}
        placeholder="Private notes about this series…"
        className="glass min-h-[100px] w-full max-w-3xl rounded-2xl bg-transparent p-4 text-sm outline-none placeholder:text-yuui-muted"
      />
    </Section>
  );
}
