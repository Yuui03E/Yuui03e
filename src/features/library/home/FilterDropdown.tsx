import type { Dispatch, SetStateAction } from "react";
import { ChevronDown } from "lucide-react";

export function FilterDropdown({
  cardSize,
  setCardSize,
  activeDropdown,
  setActiveDropdown,
  statusFilter,
  setStatusFilter,
  formatFilter,
  setFormatFilter,
  groupFilter,
  setGroupFilter,
  releaseGroups,
  sortBy,
  setSortBy,
}: {
  cardSize: number;
  setCardSize: (size: number) => void;
  activeDropdown: "status" | "format" | "group" | "sort" | null;
  setActiveDropdown: Dispatch<
    SetStateAction<"status" | "format" | "group" | "sort" | null>
  >;
  statusFilter: string;
  setStatusFilter: Dispatch<SetStateAction<string>>;
  formatFilter: string;
  setFormatFilter: Dispatch<SetStateAction<string>>;
  groupFilter: string;
  setGroupFilter: Dispatch<SetStateAction<string>>;
  releaseGroups: string[];
  sortBy: string;
  setSortBy: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div className="flex flex-col gap-2 px-0 py-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between border border-white/[0.04]">
          <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider mr-2 shrink-0">
            Card Size
          </span>
          <div className="flex-1 flex items-center gap-2">
            <input
              type="range"
              min="140"
              max="260"
              value={cardSize}
              onChange={(e) => setCardSize(Number(e.target.value))}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <span className="text-[10px] text-white font-semibold font-mono w-8 text-right shrink-0">
              {cardSize}px
            </span>
          </div>
        </div>

        {/* Status Dropdown */}
        <div className="relative">
          <div
            onClick={() =>
              setActiveDropdown(activeDropdown === "status" ? null : "status")
            }
            className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
          >
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
              Status
            </span>
            <span className="flex items-center gap-1 text-xs text-white font-semibold capitalize">
              {statusFilter === "ALL" ? "All" : statusFilter.toLowerCase()}
              <ChevronDown className="h-3 w-3 text-yuui-muted" />
            </span>
          </div>

          {activeDropdown === "status" && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActiveDropdown(null)}
              />
              <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
                {[
                  { val: "ALL", label: "All" },
                  { val: "WATCHING", label: "Watching" },
                  { val: "COMPLETED", label: "Completed" },
                  { val: "PLANNING", label: "Planning" },
                  { val: "PAUSED", label: "Paused" },
                  { val: "DROPPED", label: "Dropped" },
                ].map((opt) => (
                  <div
                    key={opt.val}
                    onClick={() => {
                      setStatusFilter(opt.val);
                      setActiveDropdown(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                      statusFilter === opt.val
                        ? "text-accent bg-accent/15 font-bold"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Format Dropdown */}
        <div className="relative">
          <div
            onClick={() =>
              setActiveDropdown(activeDropdown === "format" ? null : "format")
            }
            className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
          >
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
              Format
            </span>
            <span className="flex items-center gap-1 text-xs text-white font-semibold">
              {formatFilter === "ALL" ? "All" : formatFilter}
              <ChevronDown className="h-3 w-3 text-yuui-muted" />
            </span>
          </div>

          {activeDropdown === "format" && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActiveDropdown(null)}
              />
              <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
                {[
                  { val: "ALL", label: "All" },
                  { val: "TV", label: "TV" },
                  { val: "MOVIE", label: "Movie" },
                  { val: "OVA", label: "OVA" },
                  { val: "ONA", label: "ONA" },
                  { val: "SPECIAL", label: "Special" },
                ].map((opt) => (
                  <div
                    key={opt.val}
                    onClick={() => {
                      setFormatFilter(opt.val);
                      setActiveDropdown(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                      formatFilter === opt.val
                        ? "text-accent bg-accent/15 font-bold"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Group Dropdown */}
        <div className="relative">
          <div
            onClick={() =>
              setActiveDropdown(activeDropdown === "group" ? null : "group")
            }
            className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
          >
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
              Group
            </span>
            <span className="flex items-center gap-1 text-xs text-white font-semibold truncate max-w-[80px]">
              {groupFilter === "ALL" ? "All" : groupFilter}
              <ChevronDown className="h-3 w-3 text-yuui-muted" />
            </span>
          </div>

          {activeDropdown === "group" && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActiveDropdown(null)}
              />
              <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                <div
                  onClick={() => {
                    setGroupFilter("ALL");
                    setActiveDropdown(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                    groupFilter === "ALL"
                      ? "text-accent bg-accent/15 font-bold"
                      : "text-neutral-300 hover:text-white"
                  }`}
                >
                  All
                </div>
                {releaseGroups.map((g) => (
                  <div
                    key={g}
                    onClick={() => {
                      setGroupFilter(g);
                      setActiveDropdown(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] truncate ${
                      groupFilter === g
                        ? "text-accent bg-accent/15 font-bold"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    {g}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sort By Dropdown */}
        <div className="relative">
          <div
            onClick={() =>
              setActiveDropdown(activeDropdown === "sort" ? null : "sort")
            }
            className="glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none"
          >
            <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
              Sort By
            </span>
            <span className="flex items-center gap-1 text-xs text-white font-semibold capitalize">
              {sortBy === "title"
                ? "Title"
                : sortBy === "size"
                  ? "Size"
                  : sortBy}
              <ChevronDown className="h-3 w-3 text-yuui-muted" />
            </span>
          </div>

          {activeDropdown === "sort" && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setActiveDropdown(null)}
              />
              <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
                {[
                  { val: "title", label: "Title (A-Z)" },
                  { val: "progress", label: "Progress" },
                  { val: "score", label: "Average Score" },
                  { val: "size", label: "Disk Size" },
                ].map((opt) => (
                  <div
                    key={opt.val}
                    onClick={() => {
                      setSortBy(opt.val);
                      setActiveDropdown(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                      sortBy === opt.val
                        ? "text-accent bg-accent/15 font-bold"
                        : "text-neutral-300 hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
