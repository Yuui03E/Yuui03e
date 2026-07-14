import { invoke } from "@tauri-apps/api/core";
import type { StoredEntry } from "../../../lib/types";
import { formatBytes } from "../../../lib/format";
import { Section } from "../components/Section";

export type ActiveVideo = {
  path: string;
  episode: number;
  title: string;
};

export function OwnedFilesTable({
  entry,
  setActiveVideo,
}: {
  entry: StoredEntry;
  setActiveVideo: React.Dispatch<React.SetStateAction<ActiveVideo | null>>;
}) {
  return (
    <Section title={`Your Files (${entry.files.length})`}>
      <div className="max-w-4xl overflow-hidden rounded-2xl border border-white/[0.06]">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-yuui-muted">
            <tr>
              <th className="px-4 py-2">Ep</th>
              <th className="px-4 py-2">File</th>
              <th className="px-4 py-2">Group</th>
              <th className="px-4 py-2">Quality</th>
              <th className="px-4 py-2 text-right">Size</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {entry.files.map((f) => (
              <tr
                key={f.path}
                className="border-t border-white/[0.04] hover:bg-white/[0.02]"
              >
                <td className="px-4 py-2 text-yuui-muted">
                  {f.episode ?? "—"}
                </td>
                <td className="max-w-[360px] truncate px-4 py-2 text-white/80">
                  {f.file_name}
                </td>
                <td className="px-4 py-2 text-white/70">
                  {f.release_group ?? "—"}
                </td>
                <td className="px-4 py-2 text-white/70">
                  {[f.resolution, f.codec].filter(Boolean).join(" · ") ||
                    "—"}
                </td>
                <td className="px-4 py-2 text-right text-white/60 font-mono">
                  {formatBytes(f.size_bytes)}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() =>
                        setActiveVideo({
                          path: f.path,
                          episode: f.episode || 0,
                          title: f.file_name,
                        })
                      }
                      className="rounded-lg bg-yuui-accent/20 hover:bg-yuui-accent/35 px-3 py-1 text-xs font-semibold text-yuui-accent hover:text-white transition-all duration-200"
                    >
                      ▶ Play
                    </button>
                    <button
                      onClick={() => invoke("play_video", { path: f.path })}
                      title="Open with default system media player"
                      className="rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-1 text-xs font-medium text-white/60 hover:text-white transition-all duration-200"
                    >
                      ↗ Ext
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
