# Diseño de Cercas — Presentación de Brizna

**Qué es esto.** La especificación de ingeniería de las capas automáticas de la ley de
mantenimiento de la Presentación, adaptada a la casa de Brizna:

- **Cerca 0 — la prueba de aislamiento.** La ley suprema hecha test: un módulo entero y cada salida
  dejan el libro real **byte a byte idéntico**.
- **Capa 2 — la cerca de anclas.** Un test de la propia suite que se pone rojo *antes de publicar*
  si un ancla a la que apunta una escena ha muerto (o una escena cita un ancla nunca registrada).
- **Capa 3 — el diff de cobertura.** Un test + generador que marca toda superficie/control NUEVO
  sin escena, sin registro y sin exención explícita — y, por la ley de cobertura de Oscar
  (2026-11-13 19:40 EST), también el lado del censo: un ítem *útil* del censo sin módulo/escena
  asignado es un defecto del plan, reportado por el mismo mecanismo (§4.5).
- **Cerca bilingüe, cerca de duración, cerca de nombres.** Brizna es bilingüe de nacimiento
  (ES por defecto, pares `tx(es, en)`): aquí NO existe el atajo de Cadence de un solo idioma.

La capa 1 (anclas vivas resueltas al correr) está especificada en `ANCHOR-REGISTRY.md`; la mitad
en-vivo de la capa 2 — qué hace una escena cuando un ancla muere *en el aparato del usuario*, donde
la cerca no llega — es el contrato de seguridad de §5.

**Tierra verificada en la copia (Brizna 1.5.66).** La suite de la casa es pequeña y explícita:
`npm test` corre `node --test 'scripts/**/*.test.mjs'` y una lista cerrada de tests de `src`
(`src/lib/manual/manual-lint.test.ts`, `src/lib/balance-reconcile.test.ts`, `app-data`, `auth`),
con `node --experimental-strip-types`. El patrón de la casa para auditar superficies es la **sonda
de fuente**: `manual-lint.test.ts` lee las fuentes y afirma sobre lo que emiten (y ya vigila que
todo tema del Manual nazca como par ES/EN). Las cercas de la Presentación son sondas de fuente de
la misma familia y se añaden a esa lista cerrada — sin DOM, porque los ganchos de Brizna son
literales en el componente que los emite.

---

## 1. Archivos (todos nuevos, todos bajo el namespace de la Presentación)

| Archivo | Papel |
|---|---|
| `src/lib/presentation/anchors.ts` | El registro como datos (transcripción de `ANCHOR-REGISTRY.md`). Un registro por ancla: `{ id, strategy, locator, file, serves, presence, family? }`. |
| `src/lib/presentation/scenes/*.ts` | Manifiestos de escenas, un archivo por módulo. Un manifiesto cita **solo ids de ancla** (más textos en par ES/EN, palabras clave de búsqueda ES/EN, y banderas `optional` por paso). Nunca un localizador. |
| `src/lib/presentation/waivers.ts` | Exenciones de cobertura (§4.3) y de anclas registradas-sin-escena (§2, F-3). Datos, no comentarios — la cerca los lee. |
| `src/lib/presentation/surface-baseline.json` | La línea base de tokens de superficie para el diff de cobertura (§4.2). Generada, nunca editada a mano. |
| `src/lib/presentation/presentation-anchors.test.ts` | **La cerca de anclas** (§2–§3), añadida a la lista cerrada de `npm test`. |
| `src/lib/presentation/presentation-coverage.test.ts` | **El diff de cobertura** (§4). |
| `src/lib/presentation/presentation-texts.test.ts` | **Las cercas bilingüe, de duración y de nombres** (§6). |
| `scripts/presentation-surfaces.mjs` (+ su test) | El generador de la línea base (§4.2), estilo de herramientas `.mjs` de la casa. |

Ningún archivo existente es modificado por las cercas en sí. Las únicas ediciones que el sistema
pedirá jamás a la app son: (a) los atributos `data-present="…"` acuñados según
`ANCHOR-REGISTRY.md` §2, añadidos en la ola de integración; (b) lo que una ola futura deba hacer
para mantener las cercas en verde (§7, lista por ola).

---

## 2. Cerca 0 — la prueba de aislamiento (la cerca primera, antes que ninguna escena)

El libro real de Brizna es el negocio de Papá: clientes, saldos, pagos. Por eso la prueba no es un
trámite: es la condición de existencia del sistema.

**Qué hace.** Un test (en la familia de sondas, contra el almacén real de la app en banco) que:
1. Siembra un libro real ficticio-de-banco con un hash conocido (clientes, trabajos, pagos,
   ajustes), y toma también el hash de la capa de dispositivo que viaja en la copia.
2. Entra en la Presentación y corre un **módulo entero** de los que más daño podrían hacer si el
   sello fallara: el módulo de dinero (abona, perdona — incluida una remisión total — y declara un
   pago tardío) y el módulo de clientes (alta, unir duplicados, archivar).
3. Sale **tres veces, en tres corridas**: por el final natural, por la ✕ a mitad de escena, y por
   **muerte dura** (la app muere en mitad de una escena, simulando que el teléfono la mata).
4. Tras cada salida, re-hashea el libro real y afirma: **byte a byte idéntico**; el almacén del
   escenario ya no existe; ningún sello del escenario (` bz-stage ` o su equivalente) aparece en
   ninguna clave del libro ni de la capa de dispositivo.

**Cómo se sella (diseño, precedente de Faro).** El escenario vive en un namespace propio separado,
con bandera solo en memoria (ningún arranque puede aterrizar dentro del escenario), y con el sello
activo la Presentación **cierra por diseño** respaldo, sincronía de nube, cola offline, widgets y
grabación de «Cambios hechos»: no hay camino escribible compartido con el libro real. Es
aislamiento, no limpieza: no hay paso de «deshacer» porque nunca hay nada que deshacer.
Si la Cerca 0 está roja, no sale nada más. Punto.

## 3. Qué afirma la cerca de anclas

La cerca (`presentation-anchors.test.ts`) corre estas afirmaciones, agrupadas por superficie
(espejo de `ANCHOR-REGISTRY.md` §3) para que un fallo nombre su barrio:

- **F-0 · Paridad registro ↔ documento.** Cada id en `anchors.ts` aparece como fila en
  `ANCHOR-REGISTRY.md` y viceversa. (Si el .md no está en un checkout dado, F-0 se salta con
  `it.skip` y razón explícita, nunca pasa en silencio.)
- **F-1 · Cada localizador registrado resuelve en fuente.** Por registro, lee el archivo dueño y
  afirma que el localizador se emite: `spot` → contiene `data-spot="<valor>"` (familias: nombre del
  atributo + la forma parametrizada); `registry` → la clave existe en la fuente del registro
  nombrado (`topics.ts`, `CIFRAS_DEFAULT`, `ajustes-order.ts`, `native-plan.ts`); `id` → contiene
  `id="<id>"` o su forma plantilla; `hook` → contiene el atributo; `place` → la ruta o el nombre
  del evento existe en su sitio de uso; `new` → el archivo dueño contiene `data-present="<nombre>"`
  **exactamente una vez** (o un único sitio emisor para familias declaradas).
- **F-2 · Sin acuñaciones duplicadas ni huérfanas.** En todo `src/`, cada valor `data-present`
  se emite en un único sitio, y todo `data-present` hallado tiene fila en el registro (un ancla
  acuñada sin registro es tan roja como una muerta).
- **F-3 · Integridad referencial escena → registro.** Cada id de ancla citado por un manifiesto
  existe en `anchors.ts`. Cada registro está citado por ≥1 escena o lleva
  `status: "registered-unscened"` **con** exención en `waivers.ts` que nombre la razón y el módulo
  que lo tomará.
- **F-4 · Nada descansa en memoria sin declararlo.** Todo ítem del censo marcado VERIFY que un
  módulo enseñe debe llevar en su manifiesto `verify: "<qué falta contrastar y dónde>"`; un
  manifiesto que enseñe como hecho un punto VERIFY sin declararlo (p. ej. la dirección del Panel
  «4 deudores viajan, 3 se pintan», censo G V-4; o «quitar vacaciones devuelve los patios a sus
  días», censo C V-4) pone la cerca roja. La Presentación nunca enseña como verdad lo que solo
  consta en memoria.
- **F-5 · Sin localizadores de contrabando.** Los manifiestos se importan y se escanean en
  profundidad: ninguna clave llamada `selector`, `locator`, `x`, `y`, `coords` o `css` en ningún
  manifiesto; todo destino de paso es un string que resuelve por F-3. Es la afirmación que mantiene
  la capa 1 verdadera para siempre: una escena físicamente no puede crecer una coordenada.
- **F-6 · Honestidad de presencia.** Un paso que apunta a un ancla `estado:` debe (a) ir precedido
  en la misma escena por un paso de preparación cuyo manifiesto declare `establishes: "<el estado>"`,
  o (b) ir marcado `optional: true` (y lo gobierna el contrato de §5). Ni (a) ni (b) = rojo. Es lo
  que impide que una lección apunte, por ejemplo, a una barra Deshacer que no está pintada.

## 4. Cómo falla la cerca

- **Granularidad.** Un `it` por registro (F-1) y por escena (F-3/F-5/F-6), dentro de un `describe`
  por superficie. Un ancla muerta falla exactamente un `it`, nombrado: `anchor <id> resolves in <file>`.
- **Mensaje de fallo, accionable sin abrir este documento**, p. ej.:
  `anchor "cobros-perdonar" (data-present, serves D-R2) not found in src/routes/cobros.tsx — the control was renamed, moved, or removed. Restore the attribute, or update the registry row and every scene citing it, in this wave. Scenes affected: quick/el-dinero#4, advanced/perdonar-y-despues#2.`
  La lista «escenas afectadas» se calcula de los manifiestos al correr: el radio de daño lo dice el
  propio fallo — la pregunta «¿a qué módulos afecta este cambio?» respondida mecánicamente (la
  lista de §7 la pregunta antes a mano).
- **Consecuencia al publicar.** La cerca es un miembro ordinario de la suite: suite roja = no se
  publica, por la regla de la casa que ya gobierna cada ola. No hay camino `--skip-fence`.

## 5. Contrato de seguridad en vivo (capa 2, mitad en el aparato)

Donde la cerca no llega — el teléfono de Papá, meses después — una escena cuyo ancla ha muerto
**falla segura**: el paso se salta en silencio operativo, la escena sigue con el siguiente paso
cuyo ancla viva, y el módulo lo dice con honestidad en su tarjeta final («una parte de esta lección
ya no coincide con tu Brizna y se saltó»). Jamás apunta a un fantasma, jamás usa un localizador
alternativo, jamás una coordenada. El salto queda registrado en el propio aparato para que la
siguiente ola lo vea.

## 6. Las otras tres cercas

- **Cerca bilingüe.** Todo texto de la Presentación — pie de la tarjeta C′, pregunta corta, título
  de módulo/capítulo, palabra clave de búsqueda y **texto de ventanita de contexto** (ver §8) —
  nace como **par ES/EN** en el patrón de autoría del Manual, y la cerca lo exige igual que
  `manual-lint.test.ts` lo exige para los temas: ningún string suelto en un idioma, ninguna clave
  huérfana. Único tipo de excepción admisible: nombres propios y nombres de función de la app,
  declarados en la exención (precedente de Faro: «Folios»).
- **Cerca de duración.** La duración anunciada en cada tarjeta del índice se **calcula del propio
  registro de escenas** (suma de pies a ~200 palabras/minuto + latidos de pregunta y gesto) — nunca
  se escribe a mano. La cerca recomputa y compara: si el anuncio y el cálculo difieren, rojo. La
  honestidad de la duración es parte de la tarjeta (ley de forma del códice universal).
- **Cerca de nombres.** Las palabras clave de búsqueda y los destinos nombrados deben nombrar
  cosas reales de la app: cada palabra clave de un manifiesto debe existir como término en los
  temas del Manual o en las etiquetas vivas de la UI (sonda contra `topics.ts` y las fuentes de
  rutas); una palabra clave que nombra algo que la app no tiene es roja. Es la cerca que impide
  buscar «descuento» si Brizna no tiene descuentos.

## 7. El diff de cobertura (capa 3)

- **Generador** (`scripts/presentation-surfaces.mjs`): recorre `src/` y emite los tokens de
  superficie (cada `data-spot`, `data-present`, tema del Manual, fold de Ajustes, bloque `cif-*`,
  ruta) a `surface-baseline.json`. Determinista, ordenado, sin marcas de tiempo.
- **El diff** (`presentation-coverage.test.ts`): compara el árbol actual con la línea base. Todo
  token nuevo sin fila en el registro, sin escena y sin exención = rojo, con mensaje que nombra el
  token y el archivo: «superficie nueva sin maestro».
- **Exenciones con lista cerrada de razones** (`waivers.ts`): `no-es-ensenble` (maquinaria pura
  cuyos efectos sí se enseñan), `solo-memoria-verify` (pendiente de contraste en aparato, con su
  referencia VERIFY), `shell-nativo` (se enseña por narración/teatro, no por ancla DOM),
  `retirado` (la superficie murió; la exención caduca si el token vuelve). Una exención sin razón
  de la lista, o con la razón en texto libre, es roja.
- **§4.5 — el lado del censo.** El mismo test lleva el mapa censo→módulo del plan (§1.3 de
  `PLAN.md`): todo ítem del censo marcado útil sin módulo asignado y sin exención de la lista
  cerrada = defecto del plan, en rojo. **Nada útil cae en silencio.**

## 8. Nota de la ventanita de contexto (gramática nacida en Brizna, Oscar 20:29 EST)

La ventanita emergente de contexto es un tipo de paso de escena (`context`, nombre propuesto —
Pregunta Abierta OQ-7 del plan). Para las cercas es **un pie más**: su texto nace en par ES/EN
(cerca bilingüe), respeta los límites de brevedad (≤15 palabras por ley de forma; si el contexto no
cabe en un mensaje corto, el problema es de la escena, no de la ventanita), se somete a la
verificación de render en ambos idiomas y a ambos anchos (teléfono y pantalla grande — los textos
nunca rompen el diseño), y su paso cita un ancla como cualquier otro (F-3/F-5 aplican igual).
Ninguna cerca cuenta ventanitas: que se vuelva rutina no es un fallo de conteo, es un fallo de
diseño de la escena, y se juzga en la revisión humana de la ola (ley estructura-sobre-densidad).

## 9. Lista por ola (la disciplina permanente, 9 puntos)

En cada ola futura de Brizna, antes de publicar: (1) ¿qué módulos afecta este cambio? — dicho en el
informe de la ola; (2) anclas tocadas actualizadas en registro y documento; (3) cerca de anclas en
verde; (4) diff de cobertura corrido y exenciones revisadas; (5) Cerca 0 en verde si tocó el
almacén o el sello; (6) textos nuevos en par ES/EN y verificados renderizados a ancho de teléfono
**y** de pantalla grande; (7) duraciones recomputadas si cambió algún guion; (8) palabras clave de
búsqueda revalidadas contra la cerca de nombres; (9) las palabras de enseñanza de todo
comportamiento cambiado, actualizadas en la misma ola — la automatización detecta, bloquea y
marca; **las palabras las escribe Muse en la misma ola, nunca «después»**.
