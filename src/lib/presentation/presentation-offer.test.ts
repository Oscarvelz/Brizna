// presentation-offer.test.ts — sondas de la cadena de primera vez (OQ-8).
//
// La decisión de la oferta es pura y vive en state.ts (offerDecision +
// fingerprintIsSettled + las ayudas de almacén): estas sondas la conducen
// entera sin navegador — la matriz resuelto/elegible/preguntado, las llaves
// de la familia `bz.pres.`, la maquinaria con cualquier id estable (también
// el «dev-user» del banco, cuyo diálogo suprime el componente por espejo de
// FingerprintOffer pero cuya elegibilidad SÍ se evalúa y se guarda), y la
// forma en fuente del componente y de su montaje en la raíz SPA.
// Run: node --experimental-strip-types --test src/lib/presentation/presentation-offer.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  eligibilityKey,
  fingerprintAsked,
  fingerprintAskedKey,
  fingerprintIsSettled,
  markOfferAsked,
  offerAsked,
  offerDecision,
  offerKey,
  offerMachineryGate,
  readOfferEligibility,
  storeOfferEligibility,
  type OfferStore,
} from "./state.ts";

const SRC = join(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(join(SRC, rel), "utf8");

/** Un almacén de juguete con la forma de localStorage. */
function fakeStore(): OfferStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

const SETTLED = { asked: true, hasCredential: false, supported: true } as const;
const PENDING = { asked: false, hasCredential: false, supported: true } as const;

/* ------------------------------- las llaves ------------------------------- */

test("keys: the bz.pres. family, per user, and the house fingerprint key is only read", () => {
  assert.equal(offerKey("u1"), "bz.pres.offer.u1");
  assert.equal(eligibilityKey("u1"), "bz.pres.fresh.u1");
  assert.equal(fingerprintAskedKey("u1"), "brizna.lockAsked.u1");
  assert.notEqual(offerKey("u1"), offerKey("u2"), "keys are per account");
});

/* --------------------------- huella: ¿resuelta? --------------------------- */

test("fingerprintIsSettled: asked, credential, or unsupported settle it; pending does not", () => {
  assert.equal(fingerprintIsSettled({ asked: true, hasCredential: false, supported: true }), true);
  assert.equal(fingerprintIsSettled({ asked: false, hasCredential: true, supported: true }), true);
  assert.equal(fingerprintIsSettled({ asked: false, hasCredential: false, supported: false }), true);
  assert.equal(fingerprintIsSettled({ asked: false, hasCredential: false, supported: true }), false);
  assert.equal(
    fingerprintIsSettled({ asked: false, hasCredential: false, supported: null }),
    false,
    "support still resolving = not settled",
  );
});

/* ------------------------------ la decisión ------------------------------ */

test("decision: fresh + settled + unasked → offer", () => {
  assert.equal(offerDecision({ asked: false, eligibility: "new", fingerprint: SETTLED }), "offer");
});

test("decision: declined (asked) → never, whatever the rest says", () => {
  assert.equal(offerDecision({ asked: true, eligibility: "new", fingerprint: SETTLED }), "never");
  assert.equal(offerDecision({ asked: true, eligibility: null, fingerprint: PENDING }), "never");
});

test("decision: existing book → never (a restored book is never offered, forever)", () => {
  assert.equal(offerDecision({ asked: false, eligibility: "existing", fingerprint: SETTLED }), "never");
  assert.equal(offerDecision({ asked: false, eligibility: "existing", fingerprint: PENDING }), "never");
});

test("decision: fingerprint pending → wait (the two dialogs never stack)", () => {
  assert.equal(offerDecision({ asked: false, eligibility: "new", fingerprint: PENDING }), "wait");
  assert.equal(
    offerDecision({ asked: false, eligibility: "new", fingerprint: { asked: false, hasCredential: false, supported: null } }),
    "wait",
  );
});

test("decision: no stored verdict → wait (an offer is only born from a stored verdict)", () => {
  assert.equal(offerDecision({ asked: false, eligibility: null, fingerprint: SETTLED }), "wait");
});

test("decision: settled via credential or via unsupported device also offers", () => {
  assert.equal(
    offerDecision({ asked: false, eligibility: "new", fingerprint: { asked: false, hasCredential: true, supported: null } }),
    "offer",
  );
  assert.equal(
    offerDecision({ asked: false, eligibility: "new", fingerprint: { asked: false, hasCredential: false, supported: false } }),
    "offer",
  );
});

/* ------------------------- la maquinaria y el almacén ------------------------- */

test("machinery gate: any stable id is exercised (bench dev user included), 'local'/empty/null are not", () => {
  assert.equal(offerMachineryGate({ id: "real-user-123" }), true);
  assert.equal(offerMachineryGate({ id: "dev-user" }), true, "the bench's stable dev id evaluates + stores its verdict");
  assert.equal(offerMachineryGate({ id: "local" }), false);
  assert.equal(offerMachineryGate({ id: "" }), false);
  assert.equal(offerMachineryGate(null), false);
  assert.equal(offerMachineryGate(undefined), false);
});

test("store helpers: verdict round-trips, asked marks once, per-user isolation", () => {
  const store = fakeStore();
  assert.equal(readOfferEligibility("u1", store), null, "unevaluated reads null");
  storeOfferEligibility("u1", "new", store);
  assert.equal(readOfferEligibility("u1", store), "new");
  assert.equal(store.map.get("bz.pres.fresh.u1"), "new");
  storeOfferEligibility("u2", "existing", store);
  assert.equal(readOfferEligibility("u1", store), "new", "another user's verdict does not leak");
  assert.equal(offerAsked("u1", store), false);
  markOfferAsked("u1", store);
  assert.equal(offerAsked("u1", store), true);
  assert.equal(store.map.get("bz.pres.offer.u1"), "1");
  assert.equal(offerAsked("u2", store), false);
});

test("store helpers: a corrupt verdict value reads as unevaluated, never as 'new'", () => {
  const store = fakeStore();
  store.setItem(eligibilityKey("u1"), "banana");
  assert.equal(readOfferEligibility("u1", store), null);
});

test("fingerprintAsked reads the house key FingerprintOffer writes", () => {
  const store = fakeStore();
  assert.equal(fingerprintAsked("u1", store), false);
  store.setItem("brizna.lockAsked.u1", "1");
  assert.equal(fingerprintAsked("u1", store), true);
});

test("chain walk: evaluate → store → wait for fingerprint → offer → asked → never again", () => {
  const store = fakeStore();
  const uid = "dev-user"; // the bench's stable id: machinery fully exercised
  // 1. Nothing evaluated yet: wait, and certainly no offer.
  assert.equal(
    offerDecision({ asked: offerAsked(uid, store), eligibility: readOfferEligibility(uid, store), fingerprint: PENDING }),
    "wait",
  );
  // 2. Empty book at first evaluation → verdict stored BEFORE any dialog.
  storeOfferEligibility(uid, "new", store);
  // 3. Fingerprint still pending: wait.
  assert.equal(
    offerDecision({ asked: offerAsked(uid, store), eligibility: readOfferEligibility(uid, store), fingerprint: PENDING }),
    "wait",
  );
  // 4. Fingerprint settles (its asked key appears): offer.
  store.setItem(fingerprintAskedKey(uid), "1");
  const fp = { asked: fingerprintAsked(uid, store), hasCredential: false, supported: true };
  assert.equal(
    offerDecision({ asked: offerAsked(uid, store), eligibility: readOfferEligibility(uid, store), fingerprint: fp }),
    "offer",
  );
  // 5. Any exit marks asked: never again, even across a 'reload' (same store).
  markOfferAsked(uid, store);
  assert.equal(
    offerDecision({ asked: offerAsked(uid, store), eligibility: readOfferEligibility(uid, store), fingerprint: fp }),
    "never",
  );
});

/* --------------------------- la forma en fuente --------------------------- */

test("component shape: mirrors the fingerprint guards for the dialog, waits, and launches Q1", () => {
  const src = read("components/presentation/presentation-offer.tsx");
  assert.match(src, /isDevFallback/, "the dialog gate mirrors FingerprintOffer's dev-fallback exclusion");
  assert.match(src, /offerMachineryGate/, "eligibility machinery runs for any stable id");
  assert.match(src, /launchPresentation\("q1-mapa"\)/, "accept starts Q1 (El mapa)");
  assert.match(src, /stageOn\(\)/, "inert while the stage is on");
  assert.match(src, /listClients/, "eligibility is evaluated against the real book");
  assert.match(src, /filter: "inactive"/, "archived clients also make the book existing");
  assert.match(src, /lockSupported\(\)/, "unsupported-lock devices settle the fingerprint question");
  assert.match(src, /lockCredential\(uid\)/, "an existing lock credential settles the fingerprint question");
  assert.match(src, /setInterval/, "unsettled state is re-read on a pulse, never assumed");
  assert.match(src, /Ver la primera lección/, "the confirm copy is the brief's, born bilingual");
  assert.match(src, /See the first lesson/);
  assert.match(src, /Ahora no/);
  // Asked is written on every exit path the house dialog offers.
  assert.match(src, /onCancel=\{done\}/);
  assert.match(src, /onDismiss=\{done\}/);
});

test("mount shape: PresentationOffer sits next to FingerprintOffer in the SPA root (not in __root)", () => {
  const spaRoot = read("spa/root.tsx");
  assert.match(spaRoot, /import \{ PresentationOffer \} from "@\/components\/presentation\/presentation-offer";/);
  assert.match(spaRoot, /<FingerprintOffer \/>\s*<PresentationOffer \/>/, "mounted beside the fingerprint offer");
});
