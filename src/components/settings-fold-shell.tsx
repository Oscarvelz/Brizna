import type { ReactNode } from "react";
import { Fold } from "@/components/fold";

/** Same folding look as the other Ajustes sections. */
export function SettingsFoldShell({ id, icon, title, peek, children }: { id: string; icon: ReactNode; title: string; peek?: ReactNode; children: ReactNode }) {
  return (
    <Fold
      id={id}
      className="mb-6"
      titleClassName="text-lg"
      contentClassName="px-4 pb-4"
      peek={peek}
      title={<span className="flex items-center gap-2">{icon}{title}</span>}
    >
      {children}
    </Fold>
  );
}
