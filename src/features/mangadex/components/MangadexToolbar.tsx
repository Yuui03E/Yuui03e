import { useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Calendar,
  Sparkles,
  Sliders,
  TrendingUp,
  Star,
  History as HistoryIcon,
  ThumbsUp,
} from "lucide-react";
import type { Tab } from "./types";
import type { TagInfo } from "../api";

interface MangadexToolbarProps {
  tab: Tab;
  setTab: (t: Tab) => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  cardSize: number;
  setCardSize: (n: number) => void;
  selectedTags: string[];
  tags: TagInfo[];
  onToggleTag: (id: string) => void;
  onOpenFilters: () => void;
  moreMenuOpen: boolean;
  setMoreMenuOpen: (b: boolean) => void;
  seasonalLabel: string;
  seasonalSeason: string;
  seasonalYear: number;
  onSeasonChange: (s: string) => void;
  onYearChange: (y: number) => void;
  filtersOpen: boolean;
}

interface PrimaryTab {
  id: string;
  label: string;
  icon: typeof Clock;
}

const PRIMARY_TABS: PrimaryTab[] = [
  { id: "latest", label: "Latest Updates", icon: Clock },
  { id: "recent", label: "Recently Added", icon: Calendar },
  { id: "recommended", label: "Recommended", icon: ThumbsUp },
  { id: "seasonal", label: "seasonal", icon: Sparkles },
];

const MORE_TABS = [
  { id: "popular", label: "Popular New", icon: TrendingUp },
  { id: "top", label: "Top Rated", icon: Star },
  { id: "history", label: "History", icon: HistoryIcon },
] as const;

const MORE_LABELS: Record<string, string> = {
  popular: "Popular New",
  top: "Top Rated",
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
  tags,
  onToggleTag,
  onOpenFilters,
  moreMenuOpen,
  setMoreMenuOpen,
  seasonalLabel,
  seasonalSeason,
  seasonalYear,
  onSeasonChange,
  onYearChange,
  filtersOpen,
}: MangadexToolbarProps) {
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);

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
                  isActive ? "text-accent" : "text-yuui-muted hover:text-accent"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mangadex-tab-active"
                    className="absolute inset-0 bg-accent/10 rounded-xl border border-accent/20"
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

        {tab === "seasonal" && (
          <div className="flex items-center gap-2 ml-1 shrink-0 relative">
            {/* Custom Season Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setSeasonMenuOpen(!seasonMenuOpen);
                  setYearMenuOpen(false);
                }}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                  seasonMenuOpen
                    ? "text-accent bg-accent/10 border-accent/20"
                    : "glass border-white/[0.05] text-white/90 hover:text-accent hover:border-accent/20 hover:bg-accent/5"
                }`}
              >
                <span className="text-yuui-muted font-normal">Season:</span>
                <span className="text-yuui-accent capitalize">{seasonalSeason}</span>
                <span className="text-[9px] opacity-60">▼</span>
              </button>
              {seasonMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSeasonMenuOpen(false)} />
                  <div 
                    className="absolute left-0 mt-2 w-28 rounded-xl border border-border py-1.5 shadow-xl z-50 overflow-hidden backdrop-blur-xl"
                    style={{ backgroundColor: "var(--surface-elevated)" }}
                  >
                    {["winter", "spring", "summer", "fall"].map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          onSeasonChange(s);
                          setSeasonMenuOpen(false);
                        }}
                        className={`flex w-full items-center px-4 py-2 text-left text-xs capitalize transition-colors hover:bg-accent/10 hover:text-accent ${
                          seasonalSeason === s ? "text-accent font-semibold" : "text-white/85"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Custom Year Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setYearMenuOpen(!yearMenuOpen);
                  setSeasonMenuOpen(false);
                }}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none ${
                  yearMenuOpen
                    ? "text-accent bg-accent/10 border-accent/20"
                    : "glass border-white/[0.05] text-white/90 hover:text-accent hover:border-accent/20 hover:bg-accent/5"
                }`}
              >
                <span className="text-yuui-accent">{seasonalYear}</span>
                <span className="text-[9px] opacity-60">▼</span>
              </button>
              {yearMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setYearMenuOpen(false)} />
                  <div 
                    className="absolute left-0 mt-2 w-24 max-h-60 overflow-y-auto rounded-xl border border-border py-1.5 shadow-xl z-50 scrollbar-thin backdrop-blur-xl"
                    style={{ backgroundColor: "var(--surface-elevated)" }}
                  >
                    {Array.from(
                      { length: new Date().getFullYear() - 1989 },
                      (_, i) => new Date().getFullYear() - i
                    ).map((y) => (
                      <button
                        key={y}
                        onClick={() => {
                          onYearChange(y);
                          setYearMenuOpen(false);
                        }}
                        className={`flex w-full items-center px-4 py-2 text-left text-xs transition-colors hover:bg-accent/10 hover:text-accent ${
                          seasonalYear === y ? "text-accent font-semibold" : "text-white/85"
                        }`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* More menu dropdown */}
        <div className="relative">
          <button
            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            className={`relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 border ${
              moreMenuOpen
                ? "text-accent bg-accent/10 border-accent/20"
                : moreActive
                ? "border-accent/20 text-accent"
                : "border-transparent text-yuui-muted hover:text-accent"
            }`}
          >
            {moreActive && (
              <motion.div
                layoutId="mangadex-tab-active"
                className="absolute inset-0 bg-accent/10 rounded-xl border border-accent/20"
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
              <div 
                className="absolute right-0 mt-2 w-48 rounded-xl border border-border py-1.5 shadow-xl z-50 overflow-hidden backdrop-blur-xl"
                style={{ backgroundColor: "var(--surface-elevated)" }}
              >
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
                      className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm transition-colors hover:bg-accent/10 hover:text-accent ${
                        tab === item.id
                          ? "text-accent font-semibold"
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

        {selectedTags.map((tagId) => {
          const tagObj = tags.find((t) => t.id === tagId);
          const tagName = tagObj ? tagObj.name : tagId;
          return (
            <span
              key={tagId}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-yuui-accent bg-yuui-accent/10 border border-yuui-accent/15 shrink-0 select-none"
            >
              Tag: {tagName}
              <button
                onClick={() => onToggleTag(tagId)}
                className="hover:text-white transition-colors cursor-pointer rounded-full p-0.5"
                title={`Remove ${tagName} filter`}
              >
                ✕
              </button>
            </span>
          );
        })}
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
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              filtersOpen
                ? "text-accent bg-accent/10 border-accent/20"
                : "glass border-white/[0.05] text-white/80 hover:bg-white/[0.08]"
            }`}
            title="Tag filters"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Filters</span>
            {selectedTags.length > 0 && (
              <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                {selectedTags.length}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
