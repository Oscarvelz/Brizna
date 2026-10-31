// Public client settings for the shared "faro" Supabase project (Faro, Vela, Brizna).
// Safe to publish: every table is guarded by row-level security.
export const SUPABASE_URL = "https://bybldbmwxucdvhfqspnf.supabase.co";
export const SUPABASE_KEY = "sb_publishable_5He-O0ak3eJcniBfgBQnHA_yRKjyHi7";

const LOCAL_TEST = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  && !/[?&]cloud=1/.test(location.search);
export const CLOUD_READY = !LOCAL_TEST;
