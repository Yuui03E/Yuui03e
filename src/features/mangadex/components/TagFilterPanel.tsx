import { useMemo } from "react";
import { motion } from "framer-motion";
import { Sliders, X } from "lucide-react";
import type { TagInfo } from "../api";

interface TagFilterPanelProps {
  tags: TagInfo[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

/** Slide-over panel with tag chips grouped by tag group. */
export default function TagFilterPanel({
  tags,
  selected,
  onToggle,
  onClear,
  onClose,
}: TagFilterPanelProps) {
  const groups = useMemo(() => {
    const m = new Map<string, TagInfo[]>();
    for (const t of tags) {
      const g = t.group || "other";
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(t);
    }
    return Array.from(m.entries());
  }, [tags]);

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 20, opacity: 0 }}
      className="w-64 shrink-0 overflow-y-auto border border-border bg-surface-elevated/10 rounded-2xl p-4 backdrop-blur-md sticky top-6 max-h-[calc(100vh-220px)] scrollbar-thin select-none"
    >
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <h3 className="flex items-center gap-2 text-xs font-semibold text-white/90 uppercase tracking-wider">
          <Sliders className="h-3.5 w-3.5 text-accent" /> Filters
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-muted-foreground hover:bg-white/[0.06] hover:text-white cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {selected.length > 0 && (
        <button
          onClick={onClear}
          className="mt-2 text-[10px] text-accent hover:underline cursor-pointer font-semibold uppercase tracking-wider"
        >
          Clear {selected.length} filter{selected.length > 1 ? "s" : ""}
        </button>
      )}
      <div className="mt-4 space-y-5">
        {groups.map(([group, list]) => (
          <div key={group}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {list.map((t) => {
                const active = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => onToggle(t.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                      active
                        ? "bg-accent text-white"
                        : "bg-white/[0.04] border border-white/[0.06] text-muted-foreground hover:bg-white/[0.1] hover:text-white"
                    }`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
