import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppProviders } from "@/components/providers";
import { FloatHost } from "@/components/float-window";

export const Route = createRootRoute({
  component: () => (
    <AppProviders>
      <Outlet />
      <FloatHost />
    </AppProviders>
  ),
});
