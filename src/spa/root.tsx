import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppProviders } from "@/components/providers";
import { FloatHost } from "@/components/float-window";
import { FingerprintOffer } from "@/components/fingerprint-offer";
import { WeatherSky } from "@/components/weather-sky";

export const Route = createRootRoute({
  component: () => (
    <AppProviders>
      <WeatherSky />
      <Outlet />
      <FloatHost />
      <FingerprintOffer />
    </AppProviders>
  ),
});
