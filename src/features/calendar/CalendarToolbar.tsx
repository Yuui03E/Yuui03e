import { useState } from "react";
import {
  Search,
  Grid,
  Columns4,
  ChevronDown,
  List,
  Sliders,
} from "lucide-react";

interface CalendarToolbarProps {
  filterMode: "all" | "watchlist" | "library";
  setFilterMode: (mode: "all" | "watchlist" | "library") => void;
  selectedGenre: string;
  setSelectedGenre: (genre: string) => void;
  allGenres: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  posterWidth: number;
  setPosterWidth: (width: number) => void;
  layoutMode: "board" | "grid" | "list";
  setLayoutMode: (mode: "board" | "grid" | "list") => void;
}

export default function CalendarToolbar({
  filterMode,
  setFilterMode,
  selectedGenre,
  setSelectedGenre,
  allGenres,
  searchQuery,
  setSearchQuery,
  posterWidth,
  setPosterWidth,
  layoutMode,
  setLayoutMode,
}: CalendarToolbarProps) {
  const [activeDropdown, setActiveDropdown] = useState<"genre" | null>(null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 mt-4 pb-2 border-b border-white/[0.04]">
      <div className="flex flex-wrap items-center gap-3">

        {/* Library Filters */}
        <div className="flex items-center gap-1.5 rounded-2xl bg-white/[0.03] p-1 border border-white/[0.04] select-none">
          <button
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              filterMode === "all"
                ? "bg-white/10 text-white shadow-sm"
                : "text-yuui-muted hover:text-white"
            }`}
          >
            All Airing
          </button>
          <button
            onClick={() => setFilterMode("watchlist")}
            className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              filterMode === "watchlist"
                ? "bg-yuui-accent3/15 text-yuui-accent3 border border-yuui-accent3/20"
                : "text-yuui-muted hover:text-white"
            }`}
          >
            My Watchlist
          </button>
          <button
            onClick={() => setFilterMode("library")}
            className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              filterMode === "library"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-yuui-muted hover:text-white"
            }`}
          >
            In Library
          </button>
        </div>

        {/* Genre Dropdown */}
        <div className="relative">
          <div
            onClick={() => setActiveDropdown(activeDropdown === "genre" ? null : "genre")}
            className="glass rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
          >
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">Genre:</span>
            <span className="flex items-center gap-1 text-white font-semibold capitalize">
              {selectedGenre === "ALL" ? "All" : selectedGenre}
              <ChevronDown className="h-3 w-3 text-yuui-muted" />
            </span>
          </div>

          {activeDropdown === "genre" && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setActiveDropdown(null)} />
              <div className="absolute top-full mt-1.5 left-0 min-w-[150px] max-h-[300px] overflow-y-auto bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5 scrollbar-none">
                {allGenres.map((genre) => (
                  <div
                    key={genre}
                    onClick={() => {
                      setSelectedGenre(genre);
                      setActiveDropdown(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                      selectedGenre === genre
                        ? "text-yuui-accent3 bg-yuui-accent3/15 font-bold"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    {genre === "ALL" ? "All Genres" : genre}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right side: Search bar, Slider, & Layout Toggles */}
      <div className="flex flex-wrap items-center gap-3 flex-1 sm:flex-initial">
        {/* Title Search Input */}
        <div className="glass flex items-center gap-2 rounded-xl px-3 py-1.5 min-w-0 flex-1 sm:w-56">
          <Search className="h-3.5 w-3.5 text-yuui-muted shrink-0" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search weekly schedule..."
            className="w-full bg-transparent text-xs outline-none placeholder:text-yuui-muted"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-yuui-muted hover:text-white text-xs px-1 select-none cursor-pointer shrink-0"
            >
              ✕
            </button>
          )}
        </div>

        {/* Poster Size Slider */}
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-1.5 text-xs text-yuui-muted select-none">
          <Sliders className="h-3.5 w-3.5 text-yuui-muted" />
          <span className="font-semibold text-[10px] uppercase tracking-wider hidden md:inline">Poster:</span>
          <input
            type="range"
            min="120"
            max="360"
            step="10"
            value={posterWidth}
            onChange={(e) => setPosterWidth(Number(e.target.value))}
            className="w-16 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent focus:outline-none"
          />
          <span className="font-mono text-[10px] text-white font-bold w-9 text-right shrink-0">{posterWidth}px</span>
        </div>

        {/* Labeled Layout Selector Toggles */}
        <div className="flex items-center gap-0.5 rounded-xl bg-white/[0.03] p-1 border border-white/[0.04] select-none text-[10px] font-bold text-yuui-muted">
          <button
            onClick={() => setLayoutMode("board")}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              layoutMode === "board" ? "bg-white/10 text-white shadow-sm" : "hover:text-white"
            }`}
            title="7 Days Kanban Grid Schedule"
          >
            <Columns4 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Weekly Board</span>
          </button>
          <button
            onClick={() => setLayoutMode("grid")}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              layoutMode === "grid" ? "bg-white/10 text-white shadow-sm" : "hover:text-white"
            }`}
            title="Daily Movie Poster Grid View"
          >
            <Grid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Daily Grid</span>
          </button>
          <button
            onClick={() => setLayoutMode("list")}
            className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              layoutMode === "list" ? "bg-white/10 text-white shadow-sm" : "hover:text-white"
            }`}
            title="Daily Detailed List Cards View"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Daily List</span>
          </button>
        </div>
      </div>
    </div>
  );
}
