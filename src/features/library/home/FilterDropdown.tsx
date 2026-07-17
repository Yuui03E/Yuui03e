import type { Dispatch, SetStateAction } from "react";
import DropdownSection from "./DropdownSection";

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
  const statusOptions = [
    { value: "ALL", label: "All" },
    { value: "WATCHING", label: "Watching" },
    { value: "COMPLETED", label: "Completed" },
    { value: "PLANNING", label: "Planning" },
    { value: "PAUSED", label: "Paused" },
    { value: "DROPPED", label: "Dropped" },
  ];

  const formatOptions = [
    { value: "ALL", label: "All" },
    { value: "TV", label: "TV" },
    { value: "MOVIE", label: "Movie" },
    { value: "OVA", label: "OVA" },
    { value: "ONA", label: "ONA" },
    { value: "SPECIAL", label: "Special" },
  ];

  const groupOptions = [
    { value: "ALL", label: "All" },
    ...releaseGroups.map((g) => ({ value: g, label: g })),
  ];

  const sortOptions = [
    { value: "title", label: "Title (A-Z)" },
    { value: "progress", label: "Progress" },
    { value: "score", label: "Average Score" },
    { value: "size", label: "Disk Size" },
  ];

  return (
    <div className="flex flex-col gap-2 px-0 py-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {/* Card Size slider */}
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
        <DropdownSection
          label="Status"
          name="status"
          activeDropdown={activeDropdown}
          setActiveDropdown={setActiveDropdown as (name: string | null) => void}
          selectedValue={statusFilter}
          options={statusOptions}
          onSelect={setStatusFilter}
          formatValue={(v) => (v === "ALL" ? "All" : v.toLowerCase())}
        />

        {/* Format Dropdown */}
        <DropdownSection
          label="Format"
          name="format"
          activeDropdown={activeDropdown}
          setActiveDropdown={setActiveDropdown as (name: string | null) => void}
          selectedValue={formatFilter}
          options={formatOptions}
          onSelect={setFormatFilter}
        />

        {/* Group Dropdown */}
        <DropdownSection
          label="Group"
          name="group"
          activeDropdown={activeDropdown}
          setActiveDropdown={setActiveDropdown as (name: string | null) => void}
          selectedValue={groupFilter}
          options={groupOptions}
          onSelect={setGroupFilter}
          triggerClassName="[&_span:last-child]:truncate [&_span:last-child]:max-w-[80px]"
        />

        {/* Sort By Dropdown */}
        <DropdownSection
          label="Sort By"
          name="sort"
          activeDropdown={activeDropdown}
          setActiveDropdown={setActiveDropdown as (name: string | null) => void}
          selectedValue={sortBy}
          options={sortOptions}
          onSelect={setSortBy}
          formatValue={(v) =>
            v === "title" ? "Title" : v === "size" ? "Size" : v
          }
        />
      </div>
    </div>
  );
}
