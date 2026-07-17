import type { StaffEdge } from "../../../lib/types";
import { Section } from "../components/Section";
import { Avatar } from "../components/Avatar";

export function StaffSection({ staff }: { staff: StaffEdge[] }) {
  if (staff.length === 0) return null;
  return (
    <Section title="Staff">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {staff.map((s, i) => (
          <Avatar
            key={`${s.node?.id}-${i}`}
            src={s.node?.image?.large}
            name={s.node?.name?.full}
            sub={s.role}
          />
        ))}
      </div>
    </Section>
  );
}
