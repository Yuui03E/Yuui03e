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
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 320, opacity: 0 }}
      className="fixed right-0 top-0 bottom-0 z-30 w-80 max-w-[90vw] overflow-y-auto border-l border-white/[0.08] bg-yuui-surface/95 p-5 backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white/90">
          <Sliders className="h-4 w-4" /> Tag Filters
        </h3>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-yuui-muted hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {selected.length > 0 && (
        <button
          onClick={onClear}
          className="mt-2 text-[11px] text-yuui-accent hover:underline"
        >
          Clear {selected.length} filter{selected.length > 1 ? "s" : ""}
        </button>
      )}
      <div className="mt-4 space-y-5">
        {groups.map(([group, list]) => (
          <div key={group}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-yuui-muted">
              {group}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {list.map((t) => {
                const active = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => onToggle(t.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] transition-all ${
                      active
                        ? "bg-yuui-accent text-white"
                        : "bg-white/[0.06] text-yuui-muted hover:bg-white/[0.12]"
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
