import { createFileRoute, Outlet } from "@tanstack/react-router";
import { z } from "zod";

const searchSchema = z.object({
  filter: z
    .enum(["active", "regular", "one_time", "inactive", "owing", "triple", "blacklist", "risk"])
    .optional(),
  flow: z.enum(["altas", "bajas"]).optional(),
  since: z.string().optional(),
  until: z.string().optional(),
});

export const Route = createFileRoute("/clientes")({
  validateSearch: (s) => searchSchema.parse(s),
  component: ClientesLayout,
});

function ClientesLayout() {
  return <Outlet />;
}
