import type { NavigateFunction } from "react-router-dom";
import type { Recommendation } from "../../../lib/types";
import { Section } from "../components/Section";

export function RecommendationsSection({
  recs,
  getTargetKey,
  navigate,
}: {
  recs: Recommendation["mediaRecommendation"][];
  getTargetKey: (id: number) => string;
  navigate: NavigateFunction;
}) {
  if (recs.length === 0) return null;
  return (
    <Section title="Recommended">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {recs.map((r, i) => {
          const targetKey = getTargetKey(r!.id);
          return (
            <button
              key={`${r!.id}-${i}`}
              onClick={() =>
                navigate(`/anime/${encodeURIComponent(targetKey)}`)
              }
              className="w-[120px] shrink-0 text-left cursor-pointer group hover:scale-[1.02] active:scale-[0.98] transition-all bg-transparent border-none p-0 outline-none"
            >
              <div className="overflow-hidden rounded-xl border border-white/10 group-hover:border-yuui-accent/50 transition-colors">
                <img
                  src={
                    r!.coverImage.extraLarge || r!.coverImage.large || ""
                  }
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              </div>
              <div className="mt-1 line-clamp-2 text-xs text-white/70 group-hover:text-white transition-colors">
                {r!.title.english || r!.title.romaji}
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
