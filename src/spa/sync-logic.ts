// Pure helpers for sync.ts (kept apart so they can be tested without a browser).

/** This app's database schema: the number of its newest migration (0024_... -> 24). */
export const SCHEMA: number = (() => {
  try {
    const files = Object.keys(
      import.meta.glob("../../migrations/*.sql", { query: "?raw", import: "default", eager: true }),
    );
    return schemaOf(files);
  } catch {
    return 0;
  }
})();

export function schemaOf(files: string[]): number {
  let max = 0;
  for (const f of files) {
    const m = /(?:^|\/)(\d+)_[^/]*\.sql$/.exec(f);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** Version of the change-check hash below (stored with the sync state). */
export const HASH_V = 2;

/** What counts as "this device changed something": every table, minus the backup clock stamps
 *  (a safety copy alone is not an edit). */
export function hashView(tables: Record<string, unknown[]>): string {
  const settings = (tables.app_settings ?? []).map((row) => {
    if (!row || typeof row !== "object") return row;
    const { last_backup_at: _a, updated_at: _b, ...rest } = row as Record<string, unknown>;
    return rest;
  });
  return JSON.stringify({ ...tables, app_settings: settings });
}

/** Schema of a cloud copy (0 for copies made before 1.4.56) and whether it holds no clients or notes. */
export function snapshotMeta(json: string): { schema: number; empty: boolean } {
  try {
    const data = JSON.parse(json) as { schema?: unknown; tables?: Record<string, unknown[]> };
    const t = data.tables ?? {};
    return { schema: Number(data.schema) || 0, empty: !(t.clients?.length || t.pad_pages?.length) };
  } catch {
    return { schema: 0, empty: false };
  }
}
