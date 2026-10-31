import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppProviders } from "@/components/providers";
import { FloatHost } from "@/components/float-window";
import { FingerprintOffer } from "@/components/fingerprint-offer";

export const Route = createRootRoute({
  component: () => (
    <AppProviders>
      <Outlet />
      <FloatHost />
      <FingerprintOffer />
    </AppProviders>
  ),
});
