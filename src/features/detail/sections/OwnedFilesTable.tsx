import { useState } from "react";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FolderOpen, Copy, Check } from "lucide-react";
import type { StoredEntry } from "../../../lib/types";
import type { ActiveVideo } from "../../../lib/types/video";
import { formatBytes } from "../../../lib/format";
import { copyToClipboard, playVideoExternal } from "../../../lib/api";
import { Section } from "../components/Section";

export function OwnedFilesTable({
  entry,
  setActiveVideo,
}: {
  entry: StoredEntry;
  setActiveVideo: React.Dispatch<React.SetStateAction<ActiveVideo | null>>;
}) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const handleCopyFilename = (fileName: string, path: string) => {
    copyToClipboard(fileName).catch((err) => {
      console.error("Backend copy_to_clipboard failed", err);
    });
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <Section title={`Your Files (${entry.files.length})`}>
      <div className="max-w-4xl overflow-x-auto rounded-2xl border border-white/[0.06]">
        <table className="w-full text-left text-sm table-auto border-collapse">
          <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-yuui-muted">
            <tr>
              <th className="px-4 py-2 w-12 whitespace-nowrap">Ep</th>
              <th className="px-4 py-2 w-auto min-w-[320px]">File</th>
              <th className="px-4 py-2 w-24 whitespace-nowrap">Group</th>
              <th className="px-4 py-2 w-32 whitespace-nowrap">Quality</th>
              <th className="px-4 py-2 w-24 text-right whitespace-nowrap">
                Size
              </th>
              <th className="px-4 py-2 w-32 text-right whitespace-nowrap">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {entry.files.map((f) => (
              <tr
                key={f.path}
                className="border-t border-white/[0.04] hover:bg-white/[0.02]"
              >
                <td className="px-4 py-2 text-yuui-muted whitespace-nowrap">
                  {f.episode ?? "—"}
                </td>
                <td className="px-4 py-2 text-white/80 break-all whitespace-normal">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between group">
                    <span className="leading-relaxed pr-4">{f.file_name}</span>
                    <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200 shrink-0 mt-1 sm:mt-0">
                      <button
                        onClick={() => revealItemInDir(f.path)}
                        title="Reveal in File Explorer"
                        className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
                      >
                        <FolderOpen className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          handleCopyFilename(f.file_name, f.path);
                        }}
                        title="Copy filename"
                        className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedPath === f.path ? (
                          <Check className="h-4 w-4 text-emerald-400 animate-pulse" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2 text-white/70 whitespace-nowrap">
                  {f.release_group ?? "—"}
                </td>
                <td className="px-4 py-2 text-white/70 whitespace-nowrap">
                  {[f.resolution, f.codec].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-2 text-right text-white/60 font-mono whitespace-nowrap">
                  {formatBytes(f.size_bytes)}
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
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
                      onClick={() => playVideoExternal(f.path)}
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
