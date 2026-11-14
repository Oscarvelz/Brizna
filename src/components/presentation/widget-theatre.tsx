/**
 * widget-theatre — el teatro de widgets de AD16 (PLAN §2, OQ-1).
 *
 * Un componente PROPIO de la Presentación, pintado solo con las variables
 * del tema activo, que actúa los tres widgets de Brizna sobre un escenario
 * de pantalla de inicio. No es el widget real (eso vive en el shell Kotlin)
 * ni una maqueta inventada: se alimenta de la MISMA foto que alimenta a los
 * widgets de verdad — `getNativePlan()` (src/lib/server/lawn) pasada por
 * `buildWidget()` (src/lib/native-plan), exactamente el snapshot que
 * NativeHost empuja a BriznaNative.setWidget. Con el sello del escenario
 * activo, esa lectura cae sobre el libro-escenario: el teatro enseña el día
 * de la ficción, nunca el del libro real.
 *
 * Fidelidad (layouts Kotlin leídos: widget_hoy.xml, widget_hoy_mid.xml,
 * widget_hoy_big.xml, widget_semana.xml, widget_panel.xml):
 *  - «hoy»: tres tamaños que el widget real revela ESTIRANDO — 4×2 (conteo,
 *    próximo cliente y bloque Por cobrar), 4×3 (los 3 primeros clientes con
 *    su hora y la línea de alerta) y 4×4 (hasta 6 clientes y «y N más»).
 *    Aquí el tamaño se cambia con el control de estirar del propio teatro.
 *  - «semana»: tira de 7 días desde hoy (hoy resaltado), próximo cliente
 *    debajo y NINGÚN bloque Por cobrar — como el widget real.
 *  - «panel»: zona izquierda del día (hasta 6 clientes), zona derecha con
 *    la tira de la semana, Por cobrar con su lista de deudores y la línea
 *    de alerta.
 *
 * ⚠️ OQ-6 / censo G-11: el dato manda 4 deudores (`getNativePlan`, limit 4)
 * pero el widget Panel real solo tiene 3 filas (pd0–pd2 en su layout). Este
 * teatro pinta 3 filas, como el widget real; ninguna escena afirma cuántos
 * deudores trae el Panel (ver ad16-fuera.ts, escena ad16-panel-cobrar).
 *
 * Estado vacío honesto: si no hay foto (la lectura falla o el libro no
 * tiene día), cada pieza dice lo que el widget real dice sin snapshot:
 * «Abre Brizna para ver el día» / «…para ver la semana» (HoyWidget.kt,
 * SemanaWidget.kt, PanelWidget.kt). Con foto pero sin cortes hoy, manda el
 * propio snapshot («Día libre de cortes» / «Todo hecho por hoy»).
 *
 * Las zonas son <div data-present="teatro-…"> para que el conductor las
 * ilumine; tocarlas NO navega a ningún sitio real — en el teatro, los
 * toques se enseñan, no se ejecutan. Sin intents, sin navegación, sin
 * ninguna llamada externa más allá de getNativePlan.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { useTx } from "@/lib/i18n";
import { buildWidget } from "@/lib/native-plan";
import { getNativePlan } from "@/lib/server/lawn";

type Snapshot = ReturnType<typeof buildWidget>;
type HoySize = "4x2" | "4x3" | "4x4";

const card: CSSProperties = {
  background: "var(--color-surface)",
  color: "var(--color-fg)",
  border: "1px solid var(--color-border)",
  borderRadius: 18,
  padding: "12px 16px",
  boxShadow: "0 14px 34px rgb(0 0 0 / .25)",
  fontFamily: "var(--font-sans)",
};
const title: CSSProperties = { color: "var(--color-accent)", fontWeight: 700, fontSize: "1.05rem" };
const muted: CSSProperties = { color: "var(--color-muted)", fontSize: ".82rem" };
const hair: CSSProperties = { borderTop: "1px solid var(--color-border)", margin: "9px 0" };

function OwedBlock({ snap }: { snap: Snapshot | null }) {
  const tx = useTx();
  return (
    <div data-present="teatro-hoy-cobrar">
      <div style={hair} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={muted}>{snap?.owedLabel ?? tx("Por cobrar", "To collect")}</span>
        <span style={{ color: "var(--color-accent)", fontWeight: 700, fontSize: "1.1rem" }}>{snap?.owed ?? "$0"}</span>
      </div>
    </div>
  );
}

function HoyPiece({ snap }: { snap: Snapshot | null }) {
  const tx = useTx();
  const [size, setSize] = useState<HoySize>("4x2");
  const day = snap?.days[0] ?? null;
  const emptyLine = tx("Abre Brizna para ver el día", "Open Brizna to see the day");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 10 }} role="group" aria-label={tx("Estirar el widget", "Stretch the widget")}>
        {(["4x2", "4x3", "4x4"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            aria-pressed={size === s}
            style={{
              minHeight: 30, padding: "0 12px", borderRadius: 999, cursor: "pointer", font: "inherit", fontSize: ".8rem", fontWeight: 600,
              border: "1px solid var(--color-border)",
              background: size === s ? "var(--color-accent)" : "var(--color-surface)",
              color: size === s ? "var(--color-primary-fg)" : "var(--color-muted)",
            }}
          >
            {s.replace("x", "×")}
          </button>
        ))}
        <span style={{ ...muted, alignSelf: "center" }}>{tx("Estirar", "Stretch")}</span>
      </div>
      <div style={card}>
        <div data-present="teatro-hoy-cuerpo">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <span style={title}>{snap?.title ?? tx("Hoy", "Today")}</span>
            <span style={muted}>{day?.label ?? ""}</span>
          </div>
          {!day ? (
            <p style={{ margin: "10px 0 2px", fontSize: "1rem" }}>{emptyLine}</p>
          ) : size === "4x2" ? (
            <div style={{ display: "flex", gap: 14, alignItems: "baseline", marginTop: 8 }}>
              <span style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1 }}>{day.count}</span>
              <span>
                <span style={{ display: "block", ...muted }}>{day.countLabel}</span>
                {day.nextLabel ? <span style={{ display: "block", ...muted, marginTop: 6 }}>{day.nextLabel}</span> : null}
                <span style={{ display: "block", fontWeight: 600 }}>{day.next1}</span>
                {day.next2 ? <span style={{ display: "block", whiteSpace: "pre-line" }}>{day.next2}</span> : null}
              </span>
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <p style={{ margin: 0 }}>
                <strong style={{ fontSize: "1.3rem" }}>{day.count}</strong>{" "}
                <span style={muted}>{day.countLabel}</span>
              </p>
              <div style={{ marginTop: 7, display: "grid", gap: 5 }}>
                {day.rows.slice(0, size === "4x3" ? 3 : 6).map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <span>{r.n}</span>
                    <span style={muted}>{r.t}</span>
                  </div>
                ))}
                {day.rows.length === 0 ? <span>{day.next1}</span> : null}
              </div>
              {size === "4x3" && snap?.alertLine ? (
                <p style={{ margin: "8px 0 0", color: "var(--color-pending)", fontSize: ".85rem" }}>{snap.alertLine}</p>
              ) : null}
              {size === "4x4" && day.more ? <p style={{ margin: "7px 0 0", ...muted }}>{day.more}</p> : null}
            </div>
          )}
        </div>
        <OwedBlock snap={snap} />
      </div>
    </div>
  );
}

function WeekStrip({ snap, first }: { snap: Snapshot | null; first: number }) {
  const days = snap?.days ?? [];
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: 7 }, (_, i) => {
        const d = days[first + i];
        const isToday = i === 0;
        return (
          <div
            key={i}
            style={{
              flex: 1, textAlign: "center", padding: "6px 2px", borderRadius: 10,
              background: isToday ? "var(--color-today-bg)" : "transparent",
            }}
          >
            <span style={{ display: "block", ...muted, fontSize: ".72rem" }}>{d?.dow ?? ""}</span>
            <span style={{ display: "block", fontWeight: 700, color: isToday ? "var(--color-accent)" : "var(--color-fg)" }}>{d?.dom ?? ""}</span>
            <span style={{ display: "block", fontSize: ".78rem", color: isToday ? "var(--color-accent)" : "var(--color-muted)" }}>
              {d ? (d.count > 0 ? d.count : "—") : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SemanaPiece({ snap }: { snap: Snapshot | null }) {
  const tx = useTx();
  const day = snap?.days[0] ?? null;
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <span style={title}>{snap?.weekLabel ?? tx("Semana", "Week")}</span>
        <span style={muted}>{day?.label ?? ""}</span>
      </div>
      <div data-present="teatro-semana-tira" style={{ marginTop: 8 }}>
        <WeekStrip snap={snap} first={0} />
      </div>
      <div style={hair} />
      {!day ? (
        <p style={{ margin: "2px 0", fontSize: "1rem" }}>{tx("Abre Brizna para ver la semana", "Open Brizna to see the week")}</p>
      ) : (
        <p style={{ margin: "2px 0" }}>
          {day.nextLabel ? <span style={{ ...muted, marginRight: 8 }}>{day.nextLabel}</span> : null}
          <strong>{day.next1}</strong>
        </p>
      )}
    </div>
  );
}

function PanelPiece({ snap }: { snap: Snapshot | null }) {
  const tx = useTx();
  const day = snap?.days[0] ?? null;
  // OQ-6 / G-11: el layout real del Panel solo tiene 3 filas de deudores
  // (pd0–pd2) aunque el dato traiga 4: aquí se pintan 3, como el widget.
  const debtors = (snap?.debtors ?? []).slice(0, 3);
  return (
    <div style={{ ...card, display: "flex", gap: 16 }}>
      <div data-present="teatro-panel-dia" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <span style={title}>{snap?.title ?? tx("Hoy", "Today")}</span>
          <span style={muted}>{day?.label ?? ""}</span>
        </div>
        {!day ? (
          <p style={{ margin: "10px 0 2px" }}>{tx("Abre Brizna para ver el día", "Open Brizna to see the day")}</p>
        ) : (
          <>
            <p style={{ margin: "8px 0 0" }}>
              <strong style={{ fontSize: "1.3rem" }}>{day.count}</strong>{" "}
              <span style={muted}>{day.countLabel}</span>
            </p>
            <div style={{ marginTop: 7, display: "grid", gap: 5 }}>
              {day.rows.slice(0, 6).map((r, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>{r.n}</span>
                  <span style={muted}>{r.t}</span>
                </div>
              ))}
              {day.rows.length === 0 ? <span>{day.next1}</span> : null}
            </div>
            {day.more ? <p style={{ margin: "7px 0 0", ...muted }}>{day.more}</p> : null}
          </>
        )}
      </div>
      <div style={{ width: 1, background: "var(--color-border)" }} aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div data-present="teatro-panel-semana">
          <span style={{ fontWeight: 700 }}>{snap?.weekLabel ?? tx("Semana", "Week")}</span>
          <div style={{ marginTop: 6 }}>
            <WeekStrip snap={snap} first={0} />
          </div>
        </div>
        <div data-present="teatro-panel-cobrar">
          <div style={hair} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <span style={muted}>{snap?.owedLabel ?? tx("Por cobrar", "To collect")}</span>
            <span style={{ color: "var(--color-accent)", fontWeight: 700, fontSize: "1.1rem" }}>{snap?.owed ?? "$0"}</span>
          </div>
          <div style={{ marginTop: 6, display: "grid", gap: 5 }}>
            {debtors.map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>{d.name}</span>
                <strong>{d.amt}</strong>
              </div>
            ))}
          </div>
          {snap?.alertLine ? (
            <p style={{ margin: "8px 0 0", color: "var(--color-pending)", fontSize: ".85rem" }}>{snap.alertLine}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function WidgetTheatre({ piece }: { piece: "hoy" | "semana" | "panel" }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  useEffect(() => {
    let alive = true;
    // La foto real del escenario: la misma que alimenta a los widgets del
    // shell. Si la lectura falla, snap queda null y cada pieza pinta su
    // estado «Abre Brizna…», igual que el widget sin snapshot.
    getNativePlan()
      .then((plan) => { if (alive) setSnap(buildWidget(plan)); })
      .catch(() => { if (alive) setSnap(null); });
    return () => { alive = false; };
  }, []);
  return (
    <div
      role="img"
      aria-label={piece === "hoy" ? "Widget Hoy" : piece === "semana" ? "Widget Semana" : "Widget Panel"}
      style={{
        background: "color-mix(in srgb, var(--color-bg) 82%, var(--color-fg) 6%)",
        borderRadius: 24,
        padding: "26px 16px",
        display: "grid",
        justifyItems: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: piece === "panel" ? 640 : 430 }}>
        {piece === "hoy" ? <HoyPiece snap={snap} /> : piece === "semana" ? <SemanaPiece snap={snap} /> : <PanelPiece snap={snap} />}
      </div>
    </div>
  );
}
