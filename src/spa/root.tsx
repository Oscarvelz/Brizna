import { createRootRoute, Outlet } from "@tanstack/react-router";
import { AppProviders } from "@/components/providers";
import { FloatHost } from "@/components/float-window";
import { FingerprintOffer } from "@/components/fingerprint-offer";
import { WeatherSky } from "@/components/weather-sky";
import { NavHost } from "@/components/nav-host";
import { TapBloom } from "@/components/tap-bloom";
import { NativeHost } from "@/components/native-host";
import { Presentacion, StageHost } from "@/components/presentation/presentacion";
import { PresentationOffer } from "@/components/presentation/presentation-offer";

export const Route = createRootRoute({
  component: () => (
    <AppProviders>
      <WeatherSky />
      <StageHost>
        <Outlet />
      </StageHost>
      <Presentacion />
      <FloatHost />
      <FingerprintOffer />
      <PresentationOffer />
      <NavHost />
      <TapBloom />
      <NativeHost />
    </AppProviders>
  ),
});
