import { ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownSectionProps {
  /** The dropdown label (e.g. "Status", "Format", "Group", "Sort By") */
  label: string;
  /** Currently selected value. "ALL" is treated as "All" unless formatValue is provided. */
  selectedValue: string;
  /** Options to show in the dropdown. */
  options: DropdownOption[];
  /** Called when an option is selected. */
  onSelect: (value: string) => void;
  /** Unique name for this dropdown (used for active tracking). */
  name: string;
  /** Currently active dropdown name (from parent state). */
  activeDropdown: string | null;
  /** Toggle handler from parent. */
  setActiveDropdown: (name: string | null) => void;
  /** Optional custom formatter for the selected value display. */
  formatValue?: (value: string) => string;
  /** Optional extra class on the trigger label span. */
  triggerClassName?: string;
}

/**
 * A generic dropdown section for filter toolbars.
 * Renders a clickable trigger and a floating options menu.
 */
export default function DropdownSection({
  label,
  selectedValue,
  options,
  onSelect,
  name,
  activeDropdown,
  setActiveDropdown,
  formatValue,
  triggerClassName,
}: DropdownSectionProps) {
  const isOpen = activeDropdown === name;

  const displayValue = formatValue
    ? formatValue(selectedValue)
    : selectedValue === "ALL"
      ? "All"
      : selectedValue;

  return (
    <div className="relative">
      <div
        onClick={() =>
          setActiveDropdown(isOpen ? null : name)
        }
        className={`glass rounded-2xl px-3 py-1.5 flex items-center justify-between gap-2 border border-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer text-xs select-none ${triggerClassName || ""}`}
      >
        <span className="text-[10px] font-bold text-yuui-muted uppercase tracking-wider">
          {label}
        </span>
        <span className="flex items-center gap-1 text-xs text-white font-semibold capitalize">
          {displayValue}
          <ChevronDown className="h-3 w-3 text-yuui-muted" />
        </span>
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setActiveDropdown(null)}
          />
          <div className="absolute top-full mt-1.5 right-0 min-w-full w-max max-w-[200px] bg-black rounded-2xl p-1 z-50 shadow-[0_20px_50px_rgba(0,0,0,0.9)] border border-white/15 flex flex-col gap-0.5">
            {options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onSelect(opt.value);
                  setActiveDropdown(null);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all hover:bg-white/[0.04] ${
                  selectedValue === opt.value
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
  );
}
