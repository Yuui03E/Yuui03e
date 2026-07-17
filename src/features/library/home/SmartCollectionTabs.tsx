import type { Dispatch, SetStateAction } from "react";
import { Grid, CheckCircle2, Heart, Film, History } from "lucide-react";

export function SmartCollectionTabs({
  currentTab,
  setCurrentTab,
}: {
  currentTab: string;
  setCurrentTab: Dispatch<SetStateAction<string>>;
}) {
  return (
    <div className="flex items-center gap-1.5 px-0 mt-3 border-b border-white/[0.04] pb-2 overflow-x-auto scrollbar-none">
      {[
        { id: "ALL", label: "All Titles", icon: Grid },
        {
          id: "CONTINUE_WATCHING",
          label: "Continue Watching",
          icon: History,
        },
        { id: "COMPLETED", label: "Completed", icon: CheckCircle2 },
        { id: "FAVORITES", label: "Favorites", icon: Heart },
        { id: "MOVIES_OVAS", label: "Movies & OVAs", icon: Film },
      ].map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold select-none transition-all cursor-pointer border ${
              currentTab === tab.id
                ? "bg-yuui-accent/15 text-yuui-accent border-yuui-accent/30 font-bold font-sans"
                : "text-yuui-muted hover:text-white border-transparent hover:bg-white/[0.02] font-sans"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
