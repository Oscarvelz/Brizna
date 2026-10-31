import { smartHit } from "@/lib/fuzzy";

export function notePlain(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").toLowerCase();
}

export function noteMatches(
  page: { title: string; body: string; tags?: string; folder?: string },
  query: string,
  clients: { id: number; name: string }[],
) {
  if (!query) return true;
  const plain = notePlain(page.body);
  const tags = page.tags ?? "";
  if (query.startsWith("@")) {
    const name = query.slice(1).trim();
    if (!name) return page.body.includes("data-client=") || plain.includes("@");
    const mentioned = clients.some((c) => {
      const hit = page.body.includes(`data-client="${c.id}"`) || smartHit(name, c.name);
      return hit && smartHit(name, `${c.name} ${plain}`);
    });
    return mentioned || smartHit(name, plain);
  }
  if (query.startsWith("#")) {
    const tag = query.slice(1).trim();
    if (!tag) return tags.length > 0 || plain.includes("#");
    return (
      tags.split(",").some((item) => smartHit(tag, item)) || smartHit(tag, plain)
    );
  }
  return smartHit(query, `${page.title} ${plain} ${tags} ${page.folder ?? ""}`);
}
