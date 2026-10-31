/** Client ids named with @ in the note, longest name first so "@Cris" does not steal "@Cristel". */
export function mentionIds(text: string, clients: { id: number; name: string }[]): number[] {
  const ranked = [...clients]
    .map((client) => ({ ...client, name: client.name.trim() }))
    .filter((client) => client.name.length > 0)
    .sort((a, b) => b.name.length - a.name.length);
  const ids: number[] = [];
  let i = 0;
  while (i < text.length) {
    const at = text.indexOf("@", i);
    if (at < 0) break;
    const rest = text.slice(at + 1);
    const hit = ranked.find((client) => rest.toLowerCase().startsWith(client.name.toLowerCase()));
    if (hit) {
      if (!ids.includes(hit.id)) ids.push(hit.id);
      i = at + 1 + hit.name.length;
    } else {
      i = at + 1;
    }
  }
  return ids.slice(0, 30);
}
