/**
 * La oferta de primera vez de la Presentación (PLAN §0.8 paso 10, OQ-8).
 *
 * La cadena, con el precedente de Faro y el patrón de la casa
 * (fingerprint-offer.tsx): primera entrada → la oferta de HUELLA va primero
 * (ya existe y se dispara sola) → esta oferta → aceptar arranca Q1 («El
 * mapa») → el sistema vive después en Ajustes › Presentaciones. Se ofrece
 * UNA vez: cualquier salida escribe `bz.pres.offer.<uid>` y declinar es
 * final y silencioso — sin re-pregunta, sin aviso, sin insignia.
 *
 * Las puertas, en orden:
 *  1. Escenario apagado: la oferta nunca aparece dentro de una presentación
 *     ni se evalúa contra el libro de escenario (sus clientes son ficción
 *     sembrada: evaluar ahí envenenaría el veredicto para siempre).
 *  2. Maquinaria (offerMachineryGate): cualquier id estable evalúa y guarda
 *     el veredicto de elegibilidad — una sola vez por cuenta y aparato, y
 *     el veredicto queda guardado ANTES de que el diálogo pueda abrirse.
 *     «Nuevo» = el libro vacío en esa primera evaluación (listClients en
 *     activos E inactivos: cualquier cliente, también archivado, hace el
 *     libro «existing» — p. ej. un libro restaurado jamás recibe la oferta).
 *     Si la evaluación falla no se guarda nada y se reintenta al siguiente
 *     pulso: un veredicto equivocado sería eterno.
 *  3. Diálogo: solo cuentas reales — espejo de FingerprintOffer (ni el
 *     usuario de desarrollo ni el id "local"). Consecuencia honesta para el
 *     banco: con el usuario dev/local del arnés la maquinaria SÍ se ejerce
 *     (el veredicto aparece en localStorage), pero el diálogo no se abre;
 *     la matriz de decisión entera la prueban las sondas de
 *     presentation-offer.test.ts.
 *  4. Huella resuelta: su «preguntado» existe, o ya hay credencial de
 *     candado, o el aparato no admite huella. Mientras no, se espera
 *     releyendo en un pulso (y al volver el foco), como NotifyFold relee su
 *     estado: los dos diálogos jamás se apilan.
 */
import { useEffect, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { lockCredential, lockSupported } from "@/lib/device-lock";
import { useTx } from "@/lib/i18n";
import {
  fingerprintAsked,
  markOfferAsked,
  offerAsked,
  offerDecision,
  offerMachineryGate,
  readOfferEligibility,
  storeOfferEligibility,
} from "@/lib/presentation/state";
import { stageOn, STAGE_EVENT } from "@/lib/presentation/stage";
import { listClients } from "@/lib/server/lawn";
import { launchPresentation } from "./presentacion";

/** Cada cuánto se relee la cadena mientras algo sigue sin resolverse. */
const POLL_MS = 1500;

export function PresentationOffer() {
  const tx = useTx();
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  /** El escenario enciende/apaga sin remontar esta raíz: se escucha su
   *  evento para repintar (y jamás pintar la oferta sobre el escenario). */
  const [, setStageTick] = useState(0);
  const evaluatingRef = useRef<string | null>(null);
  const supportRef = useRef<boolean | null>(null);
  const supportPendingRef = useRef(false);

  useEffect(() => {
    const onSwitch = () => setStageTick((t) => t + 1);
    window.addEventListener(STAGE_EVENT, onSwitch);
    return () => window.removeEventListener(STAGE_EVENT, onSwitch);
  }, []);

  useEffect(() => {
    setOpen(false);
    if (!offerMachineryGate(user)) return;
    const uid = user!.id;
    // El diálogo solo se abre para cuentas reales (espejo de la huella).
    const canPresent = !user!.isDevFallback;
    let live = true;
    let timer: number | null = null;

    function stop() {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    }
    function onVisible() {
      if (document.visibilityState === "visible") check();
    }

    function check() {
      if (!live) return;
      if (stageOn()) return; // inerte en el escenario; se reintenta al salir
      const verdict = readOfferEligibility(uid);
      const decision = offerDecision({
        asked: offerAsked(uid),
        eligibility: verdict,
        fingerprint: {
          asked: fingerprintAsked(uid),
          hasCredential: Boolean(lockCredential(uid)),
          supported: supportRef.current,
        },
      });
      if (decision === "never") {
        stop();
        return;
      }
      if (verdict === null) {
        // Evaluar UNA vez (con guarda en vuelo); el veredicto se guarda
        // antes de que nada pueda ofrecerse, y este pulso no ofrece.
        if (evaluatingRef.current === uid) return;
        evaluatingRef.current = uid;
        void (async () => {
          try {
            const [active, inactive] = await Promise.all([
              listClients({ data: { filter: "active" } }),
              listClients({ data: { filter: "inactive" } }),
            ]);
            if (!live) return;
            storeOfferEligibility(uid, active.length + inactive.length > 0 ? "existing" : "new");
          } catch {
            /* sin veredicto: se reintenta en el siguiente pulso */
          } finally {
            if (evaluatingRef.current === uid) evaluatingRef.current = null;
          }
        })();
        return;
      }
      // Veredicto "new" y sin preguntar: queda la huella por resolver.
      if (
        supportRef.current === null &&
        !fingerprintAsked(uid) &&
        !lockCredential(uid) &&
        !supportPendingRef.current
      ) {
        supportPendingRef.current = true;
        void lockSupported()
          .then((ok) => {
            supportRef.current = ok;
          })
          .catch(() => {
            supportRef.current = false; // sin señal de huella: su oferta nunca vendrá
          })
          .finally(() => {
            supportPendingRef.current = false;
          });
        return;
      }
      if (decision === "offer" && canPresent) {
        setOpen(true);
        stop();
      }
    }

    check();
    timer = window.setInterval(check, POLL_MS);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      stop();
    };
  }, [user]);

  if (!user) return null;

  function done() {
    markOfferAsked(user!.id);
    setOpen(false);
  }

  function yes() {
    // El «preguntado» se escribe ANTES de lanzar: ni un cierre duro dentro
    // de Q1 puede hacer que la oferta vuelva.
    markOfferAsked(user!.id);
    setOpen(false);
    launchPresentation("q1-mapa");
  }

  return (
    <ConfirmDialog
      open={open && !stageOn()}
      front
      title={tx("¿Quieres conocer Brizna con una visita guiada?", "Want to get to know Brizna with a guided tour?")}
      description={tx(
        "Brizna se enseña a sí misma, en vivo y sobre un escenario de práctica: tu libro real no se toca. Si prefieres verla luego, vive en Ajustes › Presentaciones.",
        "Brizna teaches itself, live, on a practice stage: your real book is never touched. If you'd rather see it later, it lives in Settings › Presentations.",
      )}
      confirmLabel={tx("Ver la primera lección", "See the first lesson")}
      cancelLabel={tx("Ahora no", "Not now")}
      onConfirm={yes}
      onCancel={done}
      onDismiss={done}
    />
  );
}
