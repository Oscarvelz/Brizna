// Movimiento 3 (hallazgo 12): la fórmula de reconciliación del saldo.
// Escenarios escritos como los escritores reales los producen: cada test suma
// los movimientos tal como markJobDone / recordPayment / reopenJob /
// adjustJobAmount los dejan en trabajos y pagos, y el neto guardado tal como
// queda en clients.balance / clients.credit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileBalance } from "./balance-reconcile.ts";

const zero = { balance: 0, credit: 0, opening: 0, done: 0, paid: 0, waived: 0, prepaid: 0 };

test("cliente nuevo sin movimientos: sin deriva", () => {
  assert.deepEqual(reconcileBalance(zero), { storedNet: 0, expectedNet: 0, drift: 0 });
});

test("saldo inicial: el pago 'opening' es la base de la deuda", () => {
  const r = reconcileBalance({ ...zero, balance: 80, opening: 80 });
  assert.equal(r.drift, 0);
});

test("corte en 'owe' sin crédito: done y balance suben juntos", () => {
  const r = reconcileBalance({ ...zero, balance: 50, done: 50 });
  assert.equal(r.drift, 0);
});

test("corte cobrado el mismo día: el trabajo done y su pago 'paid' se cancelan", () => {
  const r = reconcileBalance({ ...zero, done: 50, paid: 50 });
  assert.equal(r.drift, 0);
  assert.equal(r.expectedNet, 0);
});

test("corte en 'owe' pagado con crédito: el Adelanto se cancela en el neto", () => {
  // Trabajo de 50 cubierto con 30 de crédito y 20 de deuda nueva.
  const r = reconcileBalance({ ...zero, balance: 20, credit: 0, done: 50, prepaid: 30 });
  // prepaid 30 fue el crédito creado antes; al consumirse, credit volvió a 0 y
  // el neto guardado (20) = 0 + 50 − 0 − 0 − 30.
  assert.equal(r.drift, 0);
});

test("abono al marcar hecho: paid baja la deuda y el sobrante prepaid sube el crédito", () => {
  // Deuda previa 0, trabajo de 50 en owe, abono de 70: paid 50, prepaid 20.
  const r = reconcileBalance({ ...zero, balance: 0, credit: 20, done: 50, paid: 50, prepaid: 20 });
  assert.equal(r.drift, 0);
});

test("pago suelto mayor que la deuda: el sobrante es crédito (prepaid)", () => {
  const r = reconcileBalance({ ...zero, balance: 0, credit: 25, opening: 40, paid: 40, prepaid: 25 });
  // opening 40, pago de 65: paid 40 (deuda a cero) + prepaid 25.
  assert.equal(r.drift, 0);
});

test("perdón parcial y total bajan el neto como 'waived'", () => {
  const r = reconcileBalance({ ...zero, balance: 30, done: 80, waived: 50 });
  assert.equal(r.drift, 0);
});

test("propina: pago 'paid' de monto 0 no mueve el neto", () => {
  const r = reconcileBalance({ ...zero, balance: 50, done: 50, paid: 0 });
  assert.equal(r.drift, 0);
});

test("reabrir un corte en owe retira el trabajo de done y la deuda a la vez", () => {
  // Antes de reabrir: done 100, balance 100. Tras reabrir uno de 40:
  const r = reconcileBalance({ ...zero, balance: 60, done: 60 });
  assert.equal(r.drift, 0);
});

test("ajuste de precio en owe con desborde a crédito conserva el neto", () => {
  // Trabajo de 50 en owe, pagó 40 (balance 10); el precio baja a 30:
  // balance crudo −10 → balance 0 y credit 10. done queda en 30, paid en 40.
  const r = reconcileBalance({ ...zero, balance: 0, credit: 10, done: 30, paid: 40 });
  assert.equal(r.drift, 0);
});

test("ajuste de precio en un trabajo ya pagado ajusta su pago enlazado, no la deuda", () => {
  // Trabajo pagado el mismo día: 50 → 60. El pago enlazado pasa a 60.
  const r = reconcileBalance({ ...zero, done: 60, paid: 60 });
  assert.equal(r.drift, 0);
});

test("deriva real: el contador guardado no cuadra con el libro", () => {
  const r = reconcileBalance({ ...zero, balance: 75, done: 50 });
  assert.equal(r.storedNet, 75);
  assert.equal(r.expectedNet, 50);
  assert.equal(r.drift, 25);
});

test("deriva negativa y redondeo a centavos", () => {
  const r = reconcileBalance({ ...zero, balance: 10.1, credit: 0.2, done: 33.33, paid: 11.11 });
  assert.equal(r.storedNet, 9.9);
  assert.equal(r.expectedNet, 22.22);
  assert.equal(r.drift, -12.32);
});
