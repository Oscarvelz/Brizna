// Brizna release version: package.json "version" is the single source of truth (X.Y.ZZ, two-digit patch).
// node scripts/bz-version.mjs            -> bump the patch (1.5.02 -> 1.5.03; 1.4.99 -> 1.5.00), write, print it
// node scripts/bz-version.mjs 1.6.00     -> use that version, write, print it
// KEEP=1 node scripts/bz-version.mjs     -> keep the current version, write sw.js to match, print it
// Writes package.json "version" and spa-public/sw.js `const VERSION = "brizna-X.Y.ZZ";`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PKG = path.join(root, "package.json");
const SW = path.join(root, "spa-public", "sw.js");
const FORM = /^(\d+)\.(\d+)\.(\d{2})$/;
const SW_LINE = /const VERSION = "brizna-([^"]*)";/;

const pkgText = fs.readFileSync(PKG, "utf8");
const swText = fs.readFileSync(SW, "utf8");
const pkg = JSON.parse(pkgText);
const swNow = SW_LINE.exec(swText)?.[1];
if (!swNow) throw new Error("spa-public/sw.js has no VERSION line");
const current = FORM.test(pkg.version ?? "") ? pkg.version : swNow;
if (!FORM.test(current)) throw new Error(`current version "${current}" is not X.Y.ZZ`);

function bump(v) {
  const [, a, b, c] = FORM.exec(v).map(Number);
  return c >= 99 ? `${a}.${b + 1}.00` : `${a}.${b}.${String(c + 1).padStart(2, "0")}`;
}

const arg = (process.argv[2] ?? "").trim();
let next;
if (arg) {
  if (!FORM.test(arg)) throw new Error(`version "${arg}" is not X.Y.ZZ (e.g. 1.5.03)`);
  next = arg;
} else if (process.env.KEEP === "1") {
  next = current;
} else {
  next = bump(current);
}

// package.json: replace or add the "version" line without reformatting the file.
let outPkg;
if (/"version"\s*:\s*"[^"]*"/.test(pkgText)) outPkg = pkgText.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${next}"`);
else outPkg = pkgText.replace(/"private"\s*:\s*true,/, (m) => `${m}\n  "version": "${next}",`);
if (JSON.parse(outPkg).version !== next) throw new Error("could not write package.json version");
fs.writeFileSync(PKG, outPkg);
fs.writeFileSync(SW, swText.replace(SW_LINE, `const VERSION = "brizna-${next}";`));
process.stdout.write(next);
