import { motion } from "framer-motion";
import {
  Clock,
  Calendar,
  Sparkles,
  Sliders,
  TrendingUp,
  Star,
  Heart,
  History as HistoryIcon,
} from "lucide-react";
import type { Tab } from "./types";

interface MangadexToolbarProps {
  tab: Tab;
  setTab: (t: Tab) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  cardSize: number;
  setCardSize: (n: number) => void;
  selectedTags: string[];
  onOpenFilters: () => void;
  moreMenuOpen: boolean;
  setMoreMenuOpen: (b: boolean) => void;
  seasonalLabel: string;
}

interface PrimaryTab {
  id: string;
  label: string;
  icon: typeof Clock;
}

const PRIMARY_TABS: PrimaryTab[] = [
  { id: "latest", label: "Latest Updates", icon: Clock },
  { id: "recent", label: "Recently Added", icon: Calendar },
  { id: "seasonal", label: "seasonal", icon: Sparkles },
];

const MORE_TABS = [
  { id: "popular", label: "Popular New", icon: TrendingUp },
  { id: "top", label: "Top Rated", icon: Star },
  { id: "library", label: "Library", icon: Heart },
  { id: "history", label: "History", icon: HistoryIcon },
] as const;

const MORE_LABELS: Record<string, string> = {
  popular: "Popular New",
  top: "Top Rated",
  library: "Library",
  history: "History",
};

export default function MangadexToolbar({
  tab,
  setTab,
  searchQuery,
  setSearchQuery,
  cardSize,
  setCardSize,
  selectedTags,
  onOpenFilters,
  moreMenuOpen,
  setMoreMenuOpen,
  seasonalLabel,
}: MangadexToolbarProps) {
  const moreActive =
    ["popular", "top", "library", "history"].includes(tab) && !searchQuery;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] pb-3 select-none">
      <div className="flex items-center gap-2 max-w-full relative">
        {/* Scrollable primary tabs */}
        <div className="flex gap-2 overflow-x-auto items-center pr-1 [scrollbar-width:none]">
          {PRIMARY_TABS.map((t) => {
            const label = t.label === "seasonal" ? seasonalLabel : t.label;
            const isActive = tab === t.id && !searchQuery;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSearchQuery("");
                  setTab(t.id as Tab);
                }}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
                  isActive ? "text-white" : "text-yuui-muted hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mangadex-tab-active"
                    className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/5"
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* More menu dropdown */}
        <div className="relative">
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 ${
              moreActive ? "text-white" : "text-yuui-muted hover:text-white"
            }`}
          >
            {moreActive && (
              <motion.div
                layoutId="mangadex-tab-active"
                className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/5"
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Sliders className="h-4 w-4" />
              {moreActive ? MORE_LABELS[tab] : "More"}
              <span className="text-[10px] opacity-60">▼</span>
            </span>
          </button>
          {moreMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMoreMenuOpen(false)}
              />
              <div className="glass absolute right-0 mt-2 w-48 rounded-xl border border-white/[0.08] bg-yuui-panel/95 py-1.5 shadow-xl z-50 overflow-hidden">
                {MORE_TABS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setTab(item.id as Tab);
                        setSearchQuery("");
                        setMoreMenuOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-white/[0.06] ${
                        tab === item.id
                          ? "text-yuui-accent font-semibold"
                          : "text-white/80"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {searchQuery && (
          <span className="relative px-4 py-2 rounded-xl text-sm font-semibold text-yuui-accent bg-yuui-accent/15 border border-yuui-accent/20 shrink-0">
            Search: "{searchQuery}"
          </span>
        )}
      </div>

      {/* Card size slider & Filters */}
      <div className="flex items-center gap-3">
        <div className="glass rounded-xl px-3 py-1.5 flex items-center justify-between border border-white/[0.05] gap-2">
          <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider shrink-0 mr-1">
            Card Size
          </span>
          <input
            type="range"
            min="140"
            max="260"
            value={cardSize}
            onChange={(e) => setCardSize(Number(e.target.value))}
            className="w-24 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
          />
          <span className="text-[10px] text-white font-semibold font-mono w-8 text-right shrink-0">
            {cardSize}px
          </span>
        </div>

        {!["library", "history"].includes(tab) && (
          <button
            onClick={onOpenFilters}
            className="glass rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold text-white/80 hover:bg-white/[0.08]"
            title="Tag filters"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Filters</span>
            {selectedTags.length > 0 && (
              <span className="ml-1 rounded-full bg-yuui-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                {selectedTags.length}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
