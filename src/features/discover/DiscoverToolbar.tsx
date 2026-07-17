import { motion } from "framer-motion";
import { Search } from "lucide-react";

interface DiscoverToolbarProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  activeTab: number;
  setActiveTab: (i: number) => void;
  tabs: { label: string; sort: string; seasonal: boolean }[];
  currentTab: { label: string; sort: string; seasonal: boolean };
  selectedSeason: string;
  setSelectedSeason: (v: string) => void;
  selectedYear: number;
  setSelectedYear: (v: number) => void;
  cardSize: number;
  setCardSize: (v: number) => void;
}

export default function DiscoverToolbar({
  searchQuery,
  setSearchQuery,
  activeTab,
  setActiveTab,
  tabs,
  currentTab,
  selectedSeason,
  setSelectedSeason,
  selectedYear,
  setSelectedYear,
  cardSize,
  setCardSize,
}: DiscoverToolbarProps) {
  return (
    <div className="shrink-0">
      {/* Header and Search Input */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <motion.h1
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="font-display text-4xl font-bold"
          >
            Discover <span className="text-gradient">Anime</span>
          </motion.h1>
          <p className="mt-1 text-sm text-yuui-muted">
            Browse seasonal titles, popular shows, or search AniList.
          </p>
        </div>

        {/* Search bar input field */}
        <div className="relative w-full max-w-xs no-drag">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search AniList..."
            className="w-full glass rounded-xl bg-transparent pl-10 pr-4 py-2.5 text-sm outline-none placeholder:text-yuui-muted/50 border border-white/[0.05] focus:border-yuui-accent/40 text-white"
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-yuui-muted/60" />
        </div>
      </div>

      {/* Tabs and Optional Selectors */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] pb-3 select-none">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab, i) => {
            const isActive = activeTab === i && !searchQuery;
            return (
              <button
                key={tab.label}
                onClick={() => {
                  setSearchQuery(""); // Clear search to return to tabs
                  setActiveTab(i);
                }}
                className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  isActive ? "text-white" : "text-yuui-muted hover:text-white"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="discover-tab-active"
                    className="absolute inset-0 bg-white/[0.06] rounded-xl border border-white/5"
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 25,
                    }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
          {searchQuery && (
            <span className="relative px-4 py-2 rounded-xl text-sm font-semibold text-yuui-accent bg-yuui-accent/15 border border-yuui-accent/20">
              Search: &quot;{searchQuery}&quot;
            </span>
          )}
        </div>

        {/* Card size slider and Season & Year selectors */}
        <div className="flex items-center gap-3">
          {/* Card size slider */}
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

          {/* Season & Year dropdowns for Seasonal tab */}
          {currentTab.seasonal && !searchQuery && (
            <div className="flex items-center gap-2">
              <select
                value={selectedSeason}
                onChange={(e) => setSelectedSeason(e.target.value)}
                className="glass rounded-xl bg-transparent px-3 py-1.5 text-xs font-semibold outline-none border border-white/[0.05]"
              >
                <option value="WINTER" className="bg-yuui-panel text-white">
                  Winter
                </option>
                <option value="SPRING" className="bg-yuui-panel text-white">
                  Spring
                </option>
                <option value="SUMMER" className="bg-yuui-panel text-white">
                  Summer
                </option>
                <option value="FALL" className="bg-yuui-panel text-white">
                  Fall
                </option>
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="glass rounded-xl bg-transparent px-3 py-1.5 text-xs font-semibold outline-none border border-white/[0.05]"
              >
                {[2027, 2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
                  <option
                    key={y}
                    value={y}
                    className="bg-yuui-panel text-white"
                  >
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
