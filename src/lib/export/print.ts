import type { Doc } from "./doc";

/**
 * Prints the report itself: each page is painted from the same drawing as the PDF onto a
 * canvas, and the pages are printed from this page (no download, no new tab). Printing the
 * main page, not a frame, is what Android Chrome needs.
 */
export async function printDoc(doc: Doc, title: string): Promise<void> {
  const scale = 2.2;
  const urls: string[] = [];
  for (let i = 0; i < doc.pageCount; i += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(doc.width * scale);
    canvas.height = Math.round(doc.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    doc.paint(i, ctx, scale);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
    if (blob) urls.push(URL.createObjectURL(blob));
    canvas.width = 0;
    canvas.height = 0;
    // Let the screen breathe between pages on slow phones.
    await new Promise((done) => window.setTimeout(done, 0));
  }
  document.getElementById("bz-print-pages")?.remove();
  document.getElementById("bz-print-style")?.remove();
  const style = document.createElement("style");
  style.id = "bz-print-style";
  style.textContent = `
#bz-print-pages { display: none; }
@media print {
  @page { size: letter portrait; margin: 0; }
  html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
  body.bz-printing > *:not(#bz-print-pages) { display: none !important; }
  body.bz-printing #bz-print-pages { display: block !important; }
  #bz-print-pages img { display: block; width: 8.5in; height: 11in; object-fit: contain; break-after: page; page-break-after: always; margin: 0; }
  #bz-print-pages img:last-child { break-after: auto; page-break-after: auto; }
}`;
  document.head.appendChild(style);
  const holder = document.createElement("div");
  holder.id = "bz-print-pages";
  holder.setAttribute("aria-hidden", "true");
  for (const [i, src] of urls.entries()) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = `${i + 1}`;
    holder.appendChild(img);
  }
  document.body.appendChild(holder);
  await Promise.all(
    Array.from(holder.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise((done) => {
        img.onload = done;
        img.onerror = done;
      }),
    ),
  );
  const oldTitle = document.title;
  document.title = title;
  document.body.classList.add("bz-printing");
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.body.classList.remove("bz-printing");
    document.title = oldTitle;
    holder.remove();
    style.remove();
    urls.forEach((u) => URL.revokeObjectURL(u));
  };
  // A short wait after the dialog closes: some phones still read the pages right after.
  const later = () => window.setTimeout(cleanup, 4000);
  window.addEventListener("afterprint", later, { once: true });
  await new Promise((done) => window.setTimeout(done, 60));
  window.print();
  // Some phones return from print() before the dialog closes and never fire afterprint.
  window.setTimeout(() => {
    if (document.body.classList.contains("bz-printing")) cleanup();
  }, 120000);
}
