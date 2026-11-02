import type { ReactNode } from "react";
import { Fold } from "@/components/fold";
import { Hint } from "@/components/hint";

/** Same folding look as the other Ajustes sections. */
export function SettingsFoldShell({ id, icon, title, peek, topic, children }: { id: string; icon: ReactNode; title: string; peek?: ReactNode; topic?: string; children: ReactNode }) {
  return (
    <Fold
      id={id}
      className="mb-4"
      chevronEnd
      titleClassName="text-lg"
      contentClassName="px-4 pb-4"
      peek={peek}
      hint={topic ? <Hint topic={topic} /> : undefined}
      title={<span className="flex items-center gap-2">{icon}{title}</span>}
    >
      {children}
    </Fold>
  );
}
