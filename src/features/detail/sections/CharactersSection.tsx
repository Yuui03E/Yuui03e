import { openUrl } from "@tauri-apps/plugin-opener";
import type { CharacterEdge } from "../../../lib/types";
import { humanizeEnum } from "../../../lib/format";
import { Section } from "../components/Section";
import { Avatar } from "../components/Avatar";

export function CharactersSection({
  characters,
}: {
  characters: CharacterEdge[];
}) {
  if (characters.length === 0) return null;
  return (
    <Section title="Characters & Voice Actors">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((c, i) => {
          const va = c.voiceActors?.[0];
          return (
            <div
              key={`${c.node?.id}-${i}`}
              className="glass flex items-center justify-between gap-3 rounded-2xl p-3"
            >
              <div
                onClick={() =>
                  c.node?.id &&
                  openUrl(
                    `https://anilist.co/character/${c.node.id}`,
                  ).catch(() => {})
                }
                className="cursor-pointer group flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] min-w-0"
              >
                <Avatar
                  src={c.node?.image?.large}
                  name={c.node?.name?.full}
                  sub={c.role ? humanizeEnum(c.role) : null}
                />
              </div>
              {va && (
                <div
                  onClick={() =>
                    va.id &&
                    openUrl(`https://anilist.co/staff/${va.id}`).catch(
                      () => {},
                    )
                  }
                  className="cursor-pointer group flex items-center gap-3 transition-all hover:scale-[1.02] active:scale-[0.98] text-right min-w-0"
                >
                  <Avatar
                    src={va.image?.large}
                    name={va.name?.full}
                    sub="JP"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
