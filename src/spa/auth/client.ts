// Browser build: stands in for the Grok/Better Auth client. Sign-in is Supabase (see src/spa).
import { signOutHere } from "../session";

export const authEnabled = true;
export const GROK_PROVIDERS: { providerId: string; idp: string }[] = [];
export const authClient = {
  signIn: { email: async () => ({ error: { message: "use-brizna-login" } }) },
  signUp: { email: async () => ({ error: { message: "use-brizna-login" } }) },
  useSession: () => ({ data: null, isPending: false, error: null }),
};
export function readKeepSession() { return true; }
export function writeKeepSession(_on: boolean) { /* Supabase keeps the session */ }
export function getBearerToken(): string | null { return null; }
export async function signIn(): Promise<void> { throw new Error("use-brizna-login"); }
export async function signOut(_redirectTo = "/"): Promise<void> { await signOutHere(); }
