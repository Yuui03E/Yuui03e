import type { StoredEntry } from "../../../lib/types";
import { Section } from "../components/Section";

export function AnalysisSections({ entry }: { entry: StoredEntry }) {
  return (
    <>
      {/* Phase 2: Missing episodes tracker ("what to buy") */}
      {entry.analysis && entry.analysis.missing_episodes.length > 0 && (
        <Section
          title={`Missing Episodes — ${entry.analysis.missing_episodes.length} to get`}
        >
          <div className="flex flex-wrap gap-1.5">
            {entry.analysis.missing_episodes.map((ep) => (
              <span
                key={ep}
                className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/15 text-xs font-semibold text-red-300"
              >
                {ep}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-yuui-muted">
            Owned {entry.analysis.owned_episodes.length}
            {entry.analysis.total_episodes != null
              ? ` of ${entry.analysis.total_episodes}`
              : ""}
            {entry.analysis.unknown_episode_files > 0 &&
              ` · ${entry.analysis.unknown_episode_files} unnumbered`}
          </p>
        </Section>
      )}

      {/* Phase 2: Completion bar */}
      {entry.analysis?.completion != null && (
        <div className="mt-6">
          <div className="mb-1 flex justify-between text-xs text-yuui-muted">
            <span>Completion</span>
            <span>{Math.round(entry.analysis.completion * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-yuui-accent to-yuui-accent2"
              style={{
                width: `${Math.round(entry.analysis.completion * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Phase 2: Duplicate detection */}
      {entry.analysis && entry.analysis.duplicates.length > 0 && (
        <Section title={`Duplicates — ${entry.analysis.duplicates.length}`}>
          <div className="space-y-2">
            {entry.analysis.duplicates.map((d) => (
              <div
                key={d.episode}
                className="glass flex items-center justify-between gap-3 rounded-xl p-3"
              >
                <div>
                  <div className="text-sm text-white/90">
                    Episode {d.episode}
                  </div>
                  <div className="text-xs text-yuui-muted">{d.reason}</div>
                </div>
                <span className="rounded-md bg-yellow-500/15 px-2 py-1 text-xs text-yellow-300">
                  {d.redundant.length} redundant
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Phase 2: Quality upgrades */}
      {entry.analysis && entry.analysis.upgrades.length > 0 && (
        <Section
          title={`Quality Upgrades — ${entry.analysis.upgrades.length}`}
        >
          <div className="flex flex-wrap gap-2">
            {entry.analysis.upgrades.map((u) => (
              <div
                key={u.episode}
                className="glass rounded-xl px-3 py-2 text-xs"
                title={u.note}
              >
                <span className="text-white/80">Ep {u.episode}</span>
                <span className="ml-2 text-yuui-muted">
                  {u.current_best_resolution ?? "?"}
                </span>
                <span className="ml-2 text-yuui-accent2">
                  ↑ {entry.analysis!.best_resolution}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Phase 2: Per-release-group coverage */}
      {entry.analysis && entry.analysis.groups.length > 0 && (
        <Section title="Release Group Coverage">
          <div className="space-y-2">
            {entry.analysis.groups.map((g) => (
              <div
                key={g.group}
                className="glass flex items-center justify-between gap-3 rounded-xl p-3"
              >
                <div>
                  <div className="text-sm text-white/90">{g.group}</div>
                  <div className="mt-0.5 text-xs text-yuui-muted">
                    {g.owned_episodes.length} episodes · {g.file_count} files
                  </div>
                </div>
                <div className="flex max-w-[60%] flex-wrap justify-end gap-1">
                  {g.owned_episodes.slice(0, 20).map((ep) => (
                    <span
                      key={ep}
                      className="grid h-6 w-6 place-items-center rounded bg-white/5 text-[10px] text-white/60"
                    >
                      {ep}
                    </span>
                  ))}
                  {g.owned_episodes.length > 20 && (
                    <span className="text-[10px] text-yuui-muted">
                      +{g.owned_episodes.length - 20}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
