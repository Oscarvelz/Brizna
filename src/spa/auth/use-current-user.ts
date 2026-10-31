// Browser build: the signed-in Supabase user, in the shape the app's screens expect.
import { useSyncExternalStore } from "react";
import { getUser, onUser, type BriznaUser } from "../cloud";

export type AppUser = {
  id: string;
  displayName: string | null;
  primaryEmail: string | null;
  profileImageUrl: string | null;
  isDevFallback: boolean;
};
export type CurrentUserState = { user: AppUser | null; isPending: boolean; error: unknown };

export const DEV_USER: AppUser = { id: "dev-user", displayName: "Brizna", primaryEmail: null, profileImageUrl: null, isDevFallback: true };

let cacheKey: BriznaUser | null = null;
let cacheVal: AppUser | null = null;
function snapshot(): AppUser | null {
  const u = getUser();
  if (u === cacheKey) return cacheVal;
  cacheKey = u;
  cacheVal = u ? { id: u.id, displayName: u.name || null, primaryEmail: u.email || null, profileImageUrl: null, isDevFallback: false } : null;
  return cacheVal;
}
const subscribe = (cb: () => void) => onUser(() => cb());

export function useCurrentUser(): AppUser | null {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
export function useCurrentUserState(): CurrentUserState {
  const user = useCurrentUser();
  return { user, isPending: false, error: null };
}
