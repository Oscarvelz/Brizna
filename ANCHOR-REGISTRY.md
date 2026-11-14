# Registro de Anclas — Presentación de Brizna

**Qué es esto.** El registro de anclas vivas a las que apuntan las escenas de la Presentación, y las
reglas para añadirlas. Una escena nunca guarda una coordenada, una captura ni una descripción
congelada de un control: guarda un **id de ancla** de este registro, y al correr, el reproductor lo
resuelve contra la app tal como está *hoy* (ley de mantenimiento, capa 1). Si un control se mueve,
la escena lo sigue. Si muere, la cerca (`FENCE-DESIGN.md`) se pone roja antes de publicar (capa 2) y
en vivo la escena se salta con gracia en vez de apuntar a un fantasma.

**Fuentes.** Construido desde los nueve archivos del censo en `~/workspace/brizna-presentation-work/census/`
(A navegación/Hoy 86 · B clientes 133 · C agenda 68 · D cobros/dinero 74 · E estudio/bloc/clima 77 ·
F ajustes/datos 81 · G android/externo 70 · H gestos/efímero 38 · I comunicación 54 = **681 ítems**),
contra la copia aislada `~/workspace/brizna-presentation-work/src` (Brizna **1.5.66**,
`APP_VERSION` en `src/lib/app-version.ts`, md5 verificado contra `~/workspace/brizna-1510`).
Las citas del censo van prefijadas por su letra: `B-121` = censo B, ítem 121; `R-10` = censo D,
sección Remisión, ítem 10.

**La ventaja de Brizna: la casa ya tiene sistema de anclas.** El Manual lleva desde 1.4.67 un
mecanismo «Ver en la app»: los temas del Manual (`src/lib/manual/topics.ts`, ~119 ids) declaran un
ancla y `src/lib/manual/ring.ts` dibuja el anillo sobre el elemento vivo resuelto por
`data-spot`. La Presentación no inventa su sistema: **se monta sobre el de la casa**
(ley: la integración mira primero cómo la casa integra lo mismo). Las escenas se registran como los
temas del Manual — ancla + palabras clave ES/EN — y el anillo del Manual es el ancestro directo del
foco de la Presentación.

---

## 1. Estrategias de ancla

Cada entrada del registro usa exactamente una estrategia. En orden de preferencia — siempre la más
alta que ya exista; solo se acuña una nueva cuando nada de lo anterior encaja.

| # | Estrategia | Forma del localizador | Significado |
|---|-----------|----------------------|-------------|
| B1 | `spot` | `data-spot="<valor>"` | El gancho de identidad de la casa. 27 valores únicos vivos hoy en la copia (ver §3). Resuelto en vivo por el mismo camino que usa `ring.ts`. Un valor puede nombrar varios elementos separados por espacio (`data-spot="lista-clientes ficha-deuda precio movimientos cambios-hechos"`): las familias parametrizadas se declaran como tales. |
| B2 | `registry` | una clave en un registro de datos existente | El ancla es una fila de datos que la app ya mantiene: ids de temas en `lib/manual/topics.ts`, los 16 bloques `CIFRAS_DEFAULT` (censo E), los folds de Ajustes (`ajustes-order.ts`), los planes nativos (`native-plan.ts`). Precedente de la casa: el Manual ya registra temas con ancla + palabras clave; las escenas se registran igual. |
| B3 | `id` | `#<dom-id>` | Un `id` DOM existente: `id="cif-*"` (16 bloques de Estudio), `id="dia-hoy"`, `id="en-la-mira"`, `id="hechos-hoy"` (censo A). Escaso; se usa donde ya existe. |
| B4 | `hook` | `data-<nombre>` u otro gancho emitido | Otro `data-*` o atributo estable emitido por el componente dueño (p. ej. `data-contact-row` en `job-card.tsx`, censo I). |
| B5 | `place` | un lugar nombrado al que se llega por la ruta/evento de la propia app | Una entrada, no un elemento: una ruta (`/clientes/:id`, `/fichero`…), una pestaña, o la acción de la propia app que abre la superficie. Las escenas usan B5 para *llegar* y B1–B4 para *apuntar*. |
| B6 | `new` | `data-present="<nombre>"` | Atributo NUEVO que se añade al elemento al integrar la Presentación. Solo donde B1–B5 no existen de verdad. Ley de nombres en §2. |

**Anclas de entrada vs anclas de destino.** La mayoría de las escenas necesita ambas: una B5/B2 de
entrada que lleva al alumno a la superficie (abrir la ficha, abrir Ajustes en un fold, abrir Cobros
en una vista) y una B1–B4 de destino a la que la lección apunta al llegar. Las filas del registro
son destinos salvo que se marquen *(entrada)*.

**Presencia.** Muchos ganchos de Brizna son condicionales — existen solo en un estado (la barra
Deshacer solo existe con historial, censo H/A-85; el botón «Seguir atendiendo» solo con un cliente
en alto riesgo, censo B; la dirección oculta solo tras la presión larga, censo A-55/I). Cada fila
lleva por tanto una **Presencia**: `siempre` (se pinta siempre que su superficie está) o
`estado: <qué debe ser verdad>`. Una escena que apunte a un ancla `estado:` debe primero llevar la
app a ese estado con sus pasos de preparación (contra el escenario ficticio) o marcar el paso como
opcional bajo el contrato de seguridad de `FENCE-DESIGN.md` §5.

**Anclas nativas (frente G).** Las superficies del shell Android (widgets, notificaciones, puerta de
rescate) no tienen DOM: su «ancla» es una clave del plan nativo (`native-plan.ts` / `getNativePlan`)
o una superficie nombrada del shell. Se registran con estrategia B2/B5 y presencia
`estado: shell Android`, y su puesta en escena sigue la decisión de la Pregunta Abierta OQ-1 del
plan (teatro simulado con la pieza real, precedente de Faro, vs narración). Ninguna escena nativa
apunta a coordenadas de la pantalla de inicio: apunta a la *pieza* (el widget real que Ajustes
previsualiza), igual que en Faro.

## 2. Ley de nombres para anclas NUEVAS (B6)

Los hábitos `data-*` existentes de Brizna, leídos del censo: `data-spot` con valores en español,
cortos, de superficie o familia (`vistas`, `por-cobrar`, `asesor-pasos`, `hecho propina`,
`clientes-filtros`). Las anclas nuevas de la Presentación siguen esta ley:

- El atributo es **`data-present`** — un solo atributo para todo el sistema, para que la cerca
  encuentre cada ancla acuñada con un solo grep, y una futura limpieza también.
- El valor es el nombre del ancla: **`<superficie>-<control>`**, en minúsculas con guiones,
  superficie primero, en el vocabulario de la casa (`hoy-hecho`, `ficha-abono`, `cobros-perdonar`).
- El atributo va en el **elemento interactivo exacto** al que la escena apunta — nunca en un
  envoltorio ni en la tarjeta madre — salvo donde el elemento se genera en un bucle; entonces el
  valor se parametriza con la misma clave que usa el bucle y la fila del registro declara la familia.
- Un nombre = un elemento (o una familia declarada). Nunca reusar un nombre para otro control.
- `data-present` es propiedad de la Presentación: ninguna otra función puede leerlo ni escribirlo,
  y quitar el elemento significa quitar/actualizar su fila del registro en la misma ola (la cerca
  lo exige).

## 3. Mapa honesto: superficies ricas y pobres en anclas

**Ricas (las escenas se pueden construir hoy, casi todo en B1–B3):**
- El sistema del **Manual**: ~119 temas con ancla declarada (`lib/manual/topics.ts`) + 27 valores
  `data-spot` vivos — Hoy (`vistas`, `parar-dia`, `pasar-pendientes`, `hecho propina`, `todos`),
  Cobros (`por-cobrar`, `cobrado`, `cobro-cliente`, `ficha-deuda`), Estudio/Asesor (`estudio`,
  `asesor`, `asesor-pasos`, `asesor-grupos`, `asesor-chequeos`), Bloc/Fichero (`notas`, `fichero`,
  `notas-cliente`), Clientes (`clientes-filtros`, `archivo`, `pausa`, `tipo-cliente`, `historial`,
  `movimientos`, `cambios-hechos`), Agenda (`agenda`), Clima (`clima`).
- **Estudio**: los 16 bloques llevan además `id="cif-*"` (B3) y registro en `CIFRAS_DEFAULT` (B2).

**Medias (los controles principales tienen gancho; los secundarios no):**
- **Hoy/Agenda (la tarjeta de trabajo)**: la tarjeta tiene spots de sección, pero la mayoría de
  controles individuales dentro de la tarjeta (Hecho/Posponer, asa, pin, tijerita) no llevan gancho
  propio — se resuelven por familia B1 parametrizada o primeras acuñaciones B6.
- **Ajustes**: los folds se registran en `ajustes-order.ts` (B2), pero los controles dentro de cada
  fold son en su mayoría anónimos; el módulo «Ajustes tarjeta a tarjeta» necesitará acuñaciones B6
  por fold, declaradas fold a fold.

**Pobres (planificar acuñaciones B6, o anclas B2 de registro):**
- **Comunicación (frente I)**: *ningún* botón del frente tiene `data-*` propio — los cuatro canales
  de la tarjeta, el compositor, el dictado y «A inglés» son anónimos (solo `data-contact-row` nombra
  la fila en `job-card.tsx`). Es la superficie más pobre de la app y la primera en acuñaciones.
- **La ficha del cliente**: densa en funciones (censo B: 133 ítems) con pocos ganchos por control.
- **Shell Android (frente G)**: sin DOM por definición; anclas B2 de plan nativo y superficies
  nombradas, con 18 puntos VERIFY propios (ver censo G) — ningún ancla nativa se da por verificada
  hasta contrastarla en un aparato real.

## 4. Cómo crece este registro

El registro completo, fila a fila, se transcribe a datos en la fase de construcción
(`src/lib/presentation/anchors.ts` en el diseño de cercas) a partir de las tablas del censo: cada
ítem del censo con gancho vivo nace como fila B1–B5; cada hueco nombrado en el censo («sin gancho»,
«anónimo») nace como fila B6 propuesta. Este documento fija las estrategias, la ley de nombres y el
mapa de riqueza; la transcripción fila a fila es trabajo de la ola de integración y la cerca F-0/F-1
de `FENCE-DESIGN.md` garantiza que documento y datos nunca se separen.
