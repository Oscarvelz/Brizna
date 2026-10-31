import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
export const SIGN_IN_PATH = "/";
export function SignedIn({ children }: { children: ReactNode }) { return <>{children}</>; }
export function SignedOut(_p: { children: ReactNode }) { return null; }
export function RedirectToSignIn(_p: { to?: string }) { return <Navigate to="/" />; }
export function SignInGate({ children }: { children: ReactNode }) { return <>{children}</>; }
export function SignInButtons() { return null; }
export function UserButton() { return null; }
