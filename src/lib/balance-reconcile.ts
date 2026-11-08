// MOVIMIENTO 3 (auditoría 2026-11-08, hallazgo 12) — reconciliación del saldo.
//
// La deuda de un cliente es un contador guardado (clients.balance, y su gemelo
// clients.credit) que ajustan muchos escritores independientes y que ningún
// camino recomputaba. Esta es la fórmula derivada de esos escritores:
//
//   balance − credit  =  opening + Σ trabajos 'done' − Σ pagos 'paid'
//                        − Σ pagos 'waived' − Σ pagos 'prepaid'
//
// Por qué la identidad es sobre el NETO (balance − credit) y no sobre cada
// contador por separado: el crédito que un trabajo hecho consume al completarse
// (el «Adelanto:» de markJobDone) baja el balance y baja el credit en la misma
// cantidad, así que se CANCELA en el neto — y menos mal, porque ese consumo solo
// queda anotado en las notas de los cortes, no en los extras nacidos-hechos.
// Cada escritor la conserva (verificado uno a uno):
//   · saldo inicial: inserta un pago 'opening' y pone balance = ese monto.
//   · markJobDone 'paid' (y el extra nacido-hecho con pay_same_day): inserta el
//     pago 'paid' por el monto del trabajo y suma el trabajo a 'done': se cancelan.
//   · markJobDone 'owe'/'abono': el trabajo suma a 'done' y al balance (menos el
//     crédito usado, que también baja credit); el abono inserta 'paid' (baja el
//     balance) y el sobrante 'prepaid' (sube credit): el neto se mueve igual.
//   · recordPayment / recordPaymentsBulk: 'paid' baja balance, 'waived' baja
//     balance, el sobrante 'prepaid' sube credit — cada pago mueve el neto lo
//     mismo que mueve su suma. Las propinas son pagos de monto 0: no mueven nada.
//   · undoPayment: borra el pago y devuelve su efecto al contador: se cancela.
//   · reopenJob: el trabajo sale de 'done' y su pago enlazado (o el cazado
//     legacy) se borra / el crédito usado se devuelve: se cancela.
//   · adjustJobAmount sobre un trabajo hecho: en 'owe' el delta mueve el balance
//     y el monto del trabajo a la vez (si el balance quedaba negativo, el exceso
//     pasa a credit: una transferencia interna que conserva el neto); en 'paid'
//     el delta ajusta el pago enlazado (Movimiento 3), con el mismo efecto.
//   · mergeClients / undoMerge (dups.ts): trabajos, pagos y contadores se mueven
//     juntos al otro cliente: la identidad se conserva en cada ficha.
// Lo NO derivable, y por eso se declara «base»: el REPARTO entre balance y
// credit por separado (depende del crédito usado en cada visita, que no siempre
// quedó registrado) y cualquier movimiento anterior a que existieran los pagos
// 'opening'. La reconciliación compara solo el neto derivable contra el neto
// guardado; el reparto guardado se toma como base declarada y nunca se reescribe.

export type ReconcileInput = {
  /** clients.balance guardado. */
  balance: number;
  /** clients.credit guardado. */
  credit: number;
  /** Σ pagos kind='opening'. */
  opening: number;
  /** Σ amount de trabajos con status='done'. */
  done: number;
  /** Σ pagos kind='paid' (las propinas suman 0). */
  paid: number;
  /** Σ pagos kind='waived'. */
  waived: number;
  /** Σ pagos kind='prepaid'. */
  prepaid: number;
};

export type ReconcileResult = {
  /** Neto guardado: balance − credit. */
  storedNet: number;
  /** Neto que el libro deriva con la fórmula de arriba. */
  expectedNet: number;
  /** storedNet − expectedNet, en dinero redondeado a centavos. 0 = sin deriva. */
  drift: number;
};

const cents = (n: number) => Math.round(n * 100) / 100;

export function reconcileBalance(input: ReconcileInput): ReconcileResult {
  const storedNet = cents(input.balance - input.credit);
  const expectedNet = cents(input.opening + input.done - input.paid - input.waived - input.prepaid);
  return { storedNet, expectedNet, drift: cents(storedNet - expectedNet) };
}
