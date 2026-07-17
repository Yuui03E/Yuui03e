interface HeroDropdownOption {
  value: string | number | null;
  label: string;
}

interface HeroDropdownProps {
  /** Text shown on the trigger button (or a custom node). */
  triggerLabel: string;
  /** Options to display in the dropdown. */
  options: HeroDropdownOption[];
  /** Currently selected value (compared with ===). */
  selectedValue: string | number | null;
  /** Called when an option is selected (value may be null for "clear" action). */
  onSelect: (value: string | number | null) => void;
  /** Whether this dropdown is open. */
  isOpen: boolean;
  /** Called to toggle open/closed. */
  onToggle: () => void;
  /** Called to close this dropdown. */
  onClose: () => void;
  /** Optional min-width for the dropdown menu. */
  menuMinWidth?: number;
}

/**
 * A small dropdown used in DetailHero for status/score selection.
 * Controlled (parent manages open state to allow mutual close).
 */
export default function HeroDropdown({
  triggerLabel,
  options,
  selectedValue,
  onSelect,
  isOpen,
  onToggle,
  onClose,
  menuMinWidth = 100,
}: HeroDropdownProps) {
  return (
    <div className="relative z-30">
      <button
        onClick={onToggle}
        className="glass rounded-xl bg-transparent px-3 py-2 text-sm outline-none border border-white/[0.05] text-white flex items-center gap-1.5 cursor-pointer hover:border-white/10 transition-colors animate-fade-in"
      >
        <span>{triggerLabel}</span>
        <span className="text-[9px] opacity-40">▼</span>
      </button>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          <div
            className="absolute top-full left-0 mt-1.5 z-50 glass rounded-xl py-1 bg-[#10121a]/95 border border-white/[0.08] shadow-lg overflow-hidden"
            style={{ minWidth: menuMinWidth }}
          >
            {options.map((opt) => (
              <div
                key={String(opt.value)}
                onClick={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                className={`px-3 py-2 text-xs cursor-pointer transition-colors ${
                  selectedValue === opt.value
                    ? "bg-yuui-accent/20 text-white font-bold"
                    : "text-white/70 hover:bg-white/[0.04] hover:text-white"
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
