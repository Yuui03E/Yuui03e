import type { NavigateFunction } from "react-router-dom";
import type { RelationEdge } from "../../../lib/types";
import { humanizeEnum } from "../../../lib/format";
import { Section } from "../components/Section";

export function RelationsSection({
  relations,
  getTargetKey,
  navigate,
}: {
  relations: RelationEdge[];
  getTargetKey: (id: number) => string;
  navigate: NavigateFunction;
}) {
  if (relations.length === 0) return null;
  return (
    <Section title="Relations">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {relations.map((r, i) => {
          const targetKey = getTargetKey(r.node.id);
          return (
            <button
              key={`${r.node.id}-${i}`}
              onClick={() =>
                navigate(`/anime/${encodeURIComponent(targetKey)}`)
              }
              className="w-[120px] shrink-0 text-left cursor-pointer group hover:scale-[1.02] active:scale-[0.98] transition-all bg-transparent border-none p-0 outline-none"
            >
              <div className="overflow-hidden rounded-xl border border-white/10 group-hover:border-yuui-accent/50 transition-colors">
                <img
                  src={
                    r.node.coverImage.extraLarge ||
                    r.node.coverImage.large ||
                    ""
                  }
                  alt=""
                  className="aspect-[2/3] w-full object-cover"
                />
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wide text-yuui-accent2">
                {humanizeEnum(r.relationType)}
              </div>
              <div className="line-clamp-2 text-xs text-white/70 group-hover:text-white transition-colors">
                {r.node.title.english || r.node.title.romaji}
              </div>
            </button>
          );
        })}
      </div>
    </Section>
  );
}
