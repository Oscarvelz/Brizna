# Presentación de Brizna — Plan Formal

**Estado: para la revisión de Oscar. Ninguna escena se construye hasta que él falle sobre este plan.**
Base: Brizna **1.5.66** — copia aislada en `~/workspace/brizna-presentation-work/`, tomada del árbol
local más fresco hallado (`~/workspace/brizna-1510`, `APP_VERSION = "1.5.66"` en
`src/lib/app-version.ts`; el árbol canónico `~/workspace/brizna-work` está sellado 1.5.09 y NO se
usó). Spot-check md5 idéntico entre origen y copia (`app-version.ts`, `package.json`, `router.tsx`),
228 archivos de `src` a ambos lados. La copia excluye `node_modules` y `dist` (artefactos de build,
no fuente). El canon no se ha tocado.
Fundamento: el censo de nueve frentes — A 86 · B 133 · C 68 · D 74 · E 77 · F 81 · G 70 · H 38 ·
I 54 = **681 ítems**, cada uno con su ancla de código. Documentos compañeros: `ANCHOR-REGISTRY.md`
(estrategias y mapa de anclas) y `FENCE-DESIGN.md` (Cerca 0, cerca de anclas, diff de cobertura,
cercas bilingüe/duración/nombres) — aquí se citan, no se rediseñan.

Clave de citas: **A-55** = censo A ítem 55 · **R-10** = censo D, sección Remisión · **V-n** = nota
VERIFY del frente citado.

---

## 0. La ley (asentada — no se re-litiga)

### 0.0 La ley universal de las Presentaciones (Oscar, 2026-11-13 20:14–20:20 EST, dictada en esta línea y ordenada pasar a las demás)

Obliga a todo sistema de Presentación — Faro, Cadence, Brizna, cualquier app futura:

1. **Audiencia** — «Cualquiera que utilice estos módulos los utilizará para aprender»: los módulos
   son para quien los abra, sin perfil supuesto; existen para que esa persona aprenda de verdad.
2. **Explicación total** — «bien explicadito todo»: todo explicado a fondo; nada a medias, nada
   dado por sabido.
3. **Mira premium** — «también con la mirada en premium, obviamente»: se puede entrar en cero; el
   destino es el dominio premium/avanzado, no lo básico.
4. **Totalidad** — «los módulos expliquen realmente a utilizar la app en su totalidad»: la
   cobertura es la app entera, no una selección de destacados.
5. **Estructura sobre densidad** — «bien pensada y estructurada sin abarrotar ni confundir. La idea
   es explicar claramente, no confundir»: la totalidad se alcanza por estructura — módulos bien
   pensados, una idea clara por escena — nunca amontonando. Una escena que confunde se rediseña,
   no se defiende. Breve *por escena*, total *a lo largo de la escalera*.

El códice universal completo — qué es una presentación (un guion que la app actúa en vivo, no un
video), la gramática premium, la tarjeta C′, la reproducción, la forma, la búsqueda, la ley de
funciones escondidas («cada función escondida que obviamente es útil debe salir en alguno de los
módulos; los botones o shortcuts que son súper útiles también»), las tres puertas de calidad, las
consecuencias siempre enseñadas y la maquinaria anti-caducidad — está consolidado en `~/MEMORY.md`
bajo **PRESENTATIONS — UNIVERSAL LAW · FULL CODEX** (orden de Oscar, 2026-11-13 20:23 EST). Esa
entrada gobierna todo lo que este plan no repite.

### 0.1 La ley suprema (aislamiento de datos)

Una presentación nunca toca el libro real. En Brizna el libro real es el negocio de una persona:
clientes, saldos, pagos. Cada módulo corre sobre un **escenario construido, efímero y sellado**, en
una app vacía: el motor cambia el almacén vivo por el almacén-escenario, actúa el guion ahí, y al
salir restaura el real intacto. No hay paso de limpieza porque no hay nada que limpiar — el
escenario nunca comparte un camino escribible con los datos reales; con el sello activo quedan
cerrados por diseño respaldo, nube, cola offline, widgets y «Cambios hechos».

**El libro de ejemplo NO es el escenario.** La muestra de 14 clientes conserva su trabajo aparte —
ser la vitrina que se explora a solas («una vista al futuro de lo que puede ser») — y la
Presentación no corre sobre ella: cada módulo construye solo lo que su lección necesita.

**Cerca 0 — la prueba de aislamiento (la primera cerca, escrita antes que ninguna escena).**
Siembra un libro real de banco con hash conocido; corre enteros los dos módulos con más poder de
daño (dinero: abona, perdona — también total — y declara un pago tardío; clientes: alta, unión de
duplicados, archivo); sale tres veces — final natural, ✕ a mitad de escena, y muerte dura de la app
a mitad de escena — y tras cada salida el libro real debe quedar **byte a byte idéntico** y el
escenario, desaparecido. Si la Cerca 0 está roja, no sale nada más. (Diseño completo:
`FENCE-DESIGN.md` §2.)

### 0.2 La espina del currículo (dictada por Oscar, palabra por palabra)

> «Desde cómo agregar clientes nuevos, cómo sumar, restar, abonar, dónde van cada dato, cómo
> importar en baches, qué pasa después.» (2026-11-13 20:17 EST)

**Adición de comunicación (2026-11-13 20:27 EST):**

> «A todo lo demás, añade módulos de conversación o de comunicación, cómo contactar con el cliente,
> cómo funcionan los botones dentro de las tarjetas, cómo escribir un mensaje y todo lo demás.»

**Adición de la remisión (2026-11-13 20:27 EST):**

> «Funciones como el hecho de que se puede perdonar y si de alguna forma el cliente paga después
> también es información que se puede declarar después.»

La espina, desplegada: alta de clientes · la aritmética del dinero (sumar cargos, restar, abonar)
· **dónde va cada dato** (el viaje del dato — el módulo-columna, análogo a la Cadena de Cadence y
al viaje del dígito de Faro: un dato seguido por Hoy, Agenda, Cobros, Estudio y los widgets) ·
importar en baches · y **qué pasa después** de cada acción, en ambas direcciones (la remisión
incluida: perdonar no es un callejón sin salida).

### 0.3 La tarjeta es la C′ de Faro — diseño CERRADO, adoptada tal cual

Fallada y construida en la línea de Faro, aprobada en vivo por Oscar («ahora todo se ve armonioso
y simétrico») y pasada a esta línea por su orden expresa, para no reinventar la rueda. Vive junto a
la función que explica (encima si el foco está bajo, debajo si está alto; nunca parqueada), 370px
(la pantalla menos márgenes; conserva la medida en pantallas grandes, junto al foco): hilo de
progreso de 3px en el borde superior con el acento del tema; encabezado en una línea — solo el
contador «n / total» a la izquierda, cluster de controles miniatura y callados a la derecha (~30px,
iconos ~13px; **nada de botones de 44px en esta tarjeta**: el texto manda) — modo **con su palabra**
(Automático/Interactivo), velocidad (velocímetro + «1×»), capítulos, pausa (solo Automático), ✕;
**la explicación es la protagonista**: el tipo mayor de la tarjeta, altura extra para respirar
(interlineado ~1.52), pies cortos por ley (≤15 palabras); fila baja — «Módulo · Capítulo» en tono
suave a la izquierda, «Quedarme aquí» a la derecha (con «Muéstrame tú» / «Siguiente» en
Interactivo). El selector de velocidad es **integrado**: tocar velocidad despliega las cinco
velocidades a la vez dentro de la tarjeta (0.5× · 0.75× · 1× · 1.5× · 2×), la actual rellena con el
acento, y el reloj se **pausa solo** mientras se elige — nunca ciclar de una en una. Modos
conmutables en vivo sin perder el asiento; velocidad recordada por usuario. Tarjeta, anillo de foco
y controles se pintan **solo** con las variables del tema activo; el foco es un hueco que respira
(~10px de aire) en un velo .55, con anillo y resplandor en el acento.
**Su única desviación nombrada** (registrada en Faro): el nombre del módulo no cabía en el
encabezado sin truncarse y vive en la fila baja, con su capítulo. Aquí se hereda declarada igual.

### 0.4 Gramática de Brizna: mensajes cortos y ventanitas de contexto (Oscar, 2026-11-13 20:29 EST)

Gramática nacida en esta línea y compartida con la línea de Faro por orden de Oscar:

- **El avance va con mensajes cortos** — «tiene que avanzar con mensajes cortos»: la brevedad del
  pie no es solo un límite por pie; es el **ritmo de pasos** de cada escena. Una idea, un mensaje
  corto, un paso.
- **Ventanitas emergentes de contexto** — además de la tarjeta C′, el conductor puede abrir una
  ventanita pequeña **arriba**, junto al foco/tarjeta, que explica un detalle o problemita **en
  contexto**, para que todo se entienda en su sitio. El criterio de Oscar: cuando la información
  **no se materializa directamente en los campos o los números**, la ventanita aporta el contexto
  que falta. Se usa **solo cuando es necesario** («si es necesario, claramente») — un instrumento
  nombrado y ocasional, nunca decoración y nunca un segundo canal de narración que compita con la
  tarjeta principal (doctrina de la obra: nada pide atención antes que el trabajo mismo; y ley de
  estructura-sobre-densidad: si la ventanita se vuelve rutina, la escena está mal, no el conteo).
  En el guion es un **tipo de paso** junto a `go/stage/show/ask/do/ref` — nombre de gramática
  propuesto: `contexto` (Pregunta Abierta OQ-7). Colocación: arriba, atada al foco o a la tarjeta.
  Descarte: avanza con la escena; nunca bloquea el latido interactivo («ahora tócalo tú»). Para las
  cercas es un pie más: par ES/EN, ≤ límites, verificación de render en ambos anchos
  (`FENCE-DESIGN.md` §8).
  **Ejemplos de Brizna, del propio censo:** por qué un saldo perdonado enseña $0 y sin embargo el
  cliente puede pagar después (censo D, R-10…R-13); por qué un total no incluye la deuda de un
  cliente en lista negra (la regla de totales únicos, D-40); por qué «Pospuesto» no aparece como
  estado guardado de ningún trabajo (C: es un pseudo-filtro calculado); por qué el pin de un
  atrasado no se puede quitar (A-60: viene forzado del servidor).

### 0.5 Dispositivos: TODOS (fallo de Oscar, 2026-11-13 20:13 EST)

La Presentación de Brizna se adapta a **todos los dispositivos — desde el teléfono a la
computadora**. No lleva el anuncio de Cadence («solo pantallas grandes») ni una versión recortada
para teléfono: son los mismos módulos, con la escenografía adaptada a la pantalla que corre. Lo que
obliga: las anclas deben resolver en el diseño de teléfono **y** en los diseños grandes/partidos de
tableta (la tarjeta C′ conserva sus 370px junto al foco en pantalla grande); cada texto se verifica
renderizado en **ES y EN, a ancho de teléfono y a ancho grande** — los textos nunca rompen el
diseño: las palabras se adaptan, el diseño no se estira.

### 0.6 Bilingüe de nacimiento

Brizna es bilingüe completa, **español por defecto**: cada texto es un par `tx(es, en)` y el Manual
ya vive así, vigilado por `manual-lint`. Aquí **no existe** el atajo de Cadence (inglés único):
cada pie, pregunta, título y palabra clave de la Presentación nace como par ES/EN en el patrón de
autoría del Manual, exigido por la cerca bilingüe (`FENCE-DESIGN.md` §6).

### 0.7 Las demás cercas (diseño en `FENCE-DESIGN.md`)

- **Cerca de anclas:** cada ancla que una escena nombra debe resolver en el árbol actual; muerta =
  suite roja **antes de publicar**; en vivo, la escena salta con gracia y lo dice en su tarjeta
  final, sin apuntar jamás a un fantasma, sin localizador alternativo, sin coordenadas.
- **Diff de cobertura:** toda superficie/control nuevo de una ola de Brizna sin escena asignada se
  marca en la misma ola; y todo ítem útil del censo sin módulo = defecto del plan, reportado
  (§1.3 es la línea base; razones de exención en lista cerrada).
- **Cerca de duración:** la duración anunciada de cada tarjeta del índice se **calcula del propio
  guion** (pies a ~200 ppm + latidos), nunca se escribe a mano.
- **Cerca de nombres:** toda palabra clave nombra algo real de la app (Manual o etiquetas vivas).
- **Disciplina permanente:** cada ola futura de Brizna responde en su informe «¿a qué módulos
  afecta este cambio?» y actualiza las palabras de enseñanza del comportamiento cambiado en la
  misma ola. La automatización detecta, bloquea y marca; no escribe palabras de enseñanza.

### 0.8 Orden de construcción (fase siguiente, tras el fallo de Oscar sobre este plan)

1. Censo — **hecho** (681 ítems, nueve frentes).
2. Registro de anclas como datos + cerca de anclas + diff de cobertura.
3. **Cerca 0** (prueba de aislamiento).
4. Motor (corredor de guiones, reloj, modos, marcador de la casa, escenario sellado).
5. Índice en Ajustes (el fold y las tarjetas de módulo).
6. **Piso Quick** (Q1–Q6).
7. **Puerta de revisión de Oscar** — antes de seguir.
8. Piso Advanced (AD1–AD16).
9. Registro en la búsqueda (módulos y escenas encontrables).
10. Oferta de primera vez.
11. Puerta de revisión de Oscar por piso, antes del siguiente.

---

## 1. La escalera de módulos

Convenciones: las duraciones son estimaciones honestas para **Automático a 1×** (Interactivo dura
más; la tarjeta del índice lo dirá, y al construirse las calculará la cerca de duración, no esta
tabla). Cada módulo es corto, cerrado y reanudable; **arranque libre** — el orden recomienda,
ningún módulo está tras otro. «Promesa de capacidad» es la familia de texto que llevará la tarjeta
del índice: lo que el alumno podrá **hacer** después.

### 1.0 Los casos ficticios (estrategia híbrida del códice)

**El caso continuo — Don Aurelio y su ruta.** Un cliente ficticio seguido de principio a fin: se
da de alta, se le programa el corte, llueve, se pospone, se hace el trabajo, abona una parte, se le
escribe, perdona un resto y un día paga lo perdonado. Vive donde la continuidad enseña: Q2, Q3, Q4,
AD1, AD8, AD10. Reconocerlo de módulo en módulo convierte la espina en una sola historia.
**Casos ajustados — para las lecciones más duras:** una clienta en pausa con su deuda esperando;
un «serio» que deja de recibir visitas; dos clientes casi iguales para la lección de duplicados;
una tanda de bache con un repetido dentro; un día de lluvia con tres patios para los mensajes
listos. Los números de lección son redondos y legibles de un vistazo ($40 el corte, $120 la deuda,
se perdonan $80 y quedan $40) — nunca cifras de ruido. Ningún nombre real aparece jamás; los
nombres propuestos son provisionales y Oscar puede cambiarlos (OQ-4).

### 1.1 Piso Quick — lo esencial, en orden de primer día

| # | Módulo | Promesa de capacidad | Enseña (censo) |
|---|----------|---|---|
| Q1 | **El mapa de Brizna** | Podrás moverte por las cinco pestañas y saber qué vive en cada una | Las 5 pestañas y qué hace cada una; la tarjeta de un vistazo (nombre manda, precio a su lado, pin desnudo, banda ámbar); el (?) y el Manual existen (A, H) |
| Q2 | **Tu primer cliente** | Podrás dar de alta un cliente completo y saber qué significa cada dato que pides | El alta entera campo a campo; Permanente vs Una vez; qué nace al guardar: su primera visita (B, C) |
| Q3 | **El día de trabajo** | Podrás trabajar Hoy entero: ver la ruta, fijar, y cerrar cada patio en sus tres vías | Hoy: Fijados/Atrasados/días; **Hecho y cobrado · Hecho y abonado · Hecho y pendiente** y qué pasa después de cada una; Posponer; Parar por lluvia; Pasar pendientes (A, D) |
| Q4 | **El dinero sin miedo** | Podrás sumar un cargo, abonar una parte con la calculadora y entender el saldo de cualquier cliente | Cómo nace un saldo (cortes + extras); sumar/restar; el abono con su partición invisible (lo que va a deuda y lo que queda de adelanto) dicho en voz alta (D) |
| Q5 | **Hablar con el cliente** | Podrás contactar a cualquier cliente desde su tarjeta y escribirle un mensaje completo sin miedo | Los cuatro botones dentro de la tarjeta y su tono (mensaje mostaza, WhatsApp verde, llamada azul, mapa rojo); la presión larga del mapa y la dirección secreta; escribir un mensaje de principio a fin; revisar antes de enviar — la app nunca envía sola (I, A-55) |
| Q6 | **Encontrar todo** | Podrás encontrar cualquier función, tema o lección sin que nadie te la enseñe | El Manual y su «Ver en la app»; las pistas (?); la búsqueda que también encuentra escenas, con sus dos aterrizajes (B2/F; sistema) |

### 1.2 Piso Advanced — la totalidad, hacia el dominio premium

| # | Módulo | Promesa de capacidad | Enseña (censo) |
|---|----------|---|---|
| AD1 | **El viaje del dato** *(la columna)* | Podrás seguir cualquier dato y predecir dónde se verá y qué tocará | Un cliente y un dólar seguidos por Hoy → Agenda → Cobros → Estudio/Asesor → widgets; la regla de totales únicos dicha una vez y reconocida en seis superficies (D-40, B, E, G) |
| AD2 | **La ficha entera** | Podrás usar la ficha como el expediente completo de un cliente | Editar, pista, Movimientos e Historial; extras y trabajos de una vez; **Pausa, serio y lista negra — tres mecanismos distintos**, qué hace cada uno a la deuda y a las visitas (B) |
| AD3 | **Repetidos** | Podrás detectar y unir duplicados sin perder un centavo ni un corte | El motor de parecido (nombre/teléfono/dirección); «Es otro cliente» se recuerda; al unir: copia previa, deudas que se suman, cortes del mismo día que no pasan y se cuentan; deshacer la unión (B-121…128) |
| AD4 | **Añadir varios: importar en baches** | Podrás entrar una tanda entera de clientes de una vez y revisarla antes de guardarla | «Añadir varios» (hasta 40 por tanda): contactos o pegar nombres; hoja de revisión; «Copiar a todos»; deuda compartida con puerta de monto; repetidos dentro de la tanda y contra el libro (F, B). *No confundir con Restaurar, que reemplaza el libro entero (AD15)* |
| AD5 | **La Agenda de verdad** | Podrás leer la Agenda como el futuro del negocio y mover cualquier visita sin romper la siembra | Cómo nace una visita (frecuencia anclada al inicio, horizonte, poda, lo movido a mano queda fijo); los estados verdaderos — Tarde se calcula, **«Pospuesto» no es un estado** sino una lectura; Mover; días libres y días raros, el domingo (C) |
| AD6 | **Temporadas y vacaciones** | Podrás frenar y reanudar el negocio sin desordenar ningún patio | Temporadas; Vacaciones y qué pasa al ponerlas y al quitarlas (con el punto VERIFY C V-4 declarado: lo que el código hace vs lo que el Manual dice, hasta contrastarlo) (C, F) |
| AD7 | **Cobros a fondo** | Podrás leer Cobros como un tablero de riesgo y cobrar en el orden que protege el negocio | Las vistas (Por cobrar/Abonado/Cobrado); En espera y **Alto riesgo** (sus tres disparadores y la congelación de visitas); los dos relojes del dinero (cuándo entra vs cuándo se trabajó) (D) |
| AD8 | **Perdonar — y después** | Podrás perdonar parte o todo, deshacerlo, y declarar el pago si el cliente paga después | El ciclo completo en **ambas direcciones** (§2.1): perdón parcial con cifras, total, en grupo con su confirmación, la remisión dentro de Deshacer; el reloj de atraso que se reinicia; y el camino real del pago tardío tras un perdón total (D, R-1…R-14) |
| AD9 | **Estudio y el Asesor** | Podrás leer tus cifras en el orden correcto y saber qué te está diciendo el Asesor — y qué no puede decirte | Los 16 bloques y su reorden; el héroe «Te deben» y su población exacta; el Asesor es reglas, **no IA**: sin base no se inventa (sus puertas, su puntaje) (E) |
| AD10 | **Comunicación completa** | Podrás dictar, traducir y enviar mensajes como un profesional en dos idiomas | Dictado en español y su escalera; dictado con traducción; «A inglés» con su glosario de jardinería; mensajes listos (incl. los de lluvia desde Clima); la doble puerta de revisión antes de enviar, también en llamada y mapa (I, E-Clima) |
  *Nota 1.5.69 (canon, misma ola que OQ-5):* «A inglés» ahora traduce con el traductor online de Google cuando hay conexión; sin red, con el motor del teléfono. AD10 enseña esa doble vía tal cual.
| AD11 | **Bloc y Fichero** | Podrás usar las notas como la memoria del negocio sin perder nunca un borrador | Notas con @menciones; el doble toque Notas→Fichero; el borrador protegido en 3 ranuras y qué sí se pierde al cerrar de verdad; la calculadora que custodia el cursor; la papelera con su caducidad (E, H) |
| AD12 | **El clima que decide** | Podrás decidir cortar, esperar o avisar con el clima como instrumento | El veredicto Cortar/Esperar/Alerta y sus umbrales; el Plan de hoy a ~45 min/patio; el radar; la honestidad de la lectura («Datos de las H:MM»); el cielo que repinta la app (E) |
| AD13 | **Manos y memoria** | Podrás moverte como un experto y saber qué recuerda la app y qué olvida | El swipe de páginas entero (con ratón también); la Malla que cicla solo en el teléfono; Vista partida y ventana flotante con sus dos dobles toques distintos; **el asa que miente** (puntos sin arrastre); el mapa de lo efímero: qué persiste, qué es de sesión, qué se pierde (H, A, E) |
| AD14 | **Ajustes, tarjeta a tarjeta** | Podrás configurar Brizna entera a tu manera y saber qué toca cada ajuste | Los **17 pliegues** reales (no 13: Sonidos y Nube/Huella viven fuera del archivo principal), uno a uno; los tres «Ajustes rápidos» escondidos dentro del fold del Manual; umbrales, recordatorios, tema e idioma (F) |
| AD15 | **Tus datos, a salvo** | Podrás respaldar, restaurar y moverte de aparato sin perder ni inventar nada | El respaldo v6: qué viaja y **qué nunca viaja** (sesión, cola, fotos); las 4 puertas que rechazan una copia mala en voz alta; Restaurar ≠ Añadir varios; la muestra de 14 y cómo se quita sin tocar lo real; el libro provisional sin red y «la red observa antes de reescribir» (F) |
| AD16 | **Fuera de la app** | Podrás poner los widgets, recibir los avisos en el día exacto y rescatar la app si un día no abre | Widgets Hoy (y sus tamaños que solo se descubren estirando), Semana y el Panel; las notificaciones con alarma exacta que aterrizan en el día de Agenda; los dos sistemas de recordatorio desambiguados; la huella; el dictado del shell; la puerta de rescate, el candado fantasma y la recuperación silenciosa (G) |

### 1.3 Mapa de cobertura (censo → módulo)

Cada frente tiene casa; ningún ítem útil queda sin módulo ni sin razón nombrada:

- **A (86)** → Q1, Q3, Q5, AD13, AD16 · **B (133)** → Q2, AD1, AD2, AD3, AD4 · **C (68)** → Q2, Q3, AD5, AD6
- **D (74)** → Q3, Q4, AD1, AD7, AD8 · **E (77)** → AD9, AD11, AD12 (+ AD10 los mensajes de Clima)
- **F (81)** → AD4, AD14, AD15 (+ Q6 el Manual) · **G (70)** → AD16, AD1, AD10 · **H (38)** → AD13, Q1, AD11
- **I (54)** → Q5, AD10 (+ Q3 la presión larga del mapa nace en la tarjeta)

**Sin escena, con razón (lista cerrada de exenciones — el defecto sería callarlas):**
1. **El parser CSV/vCard de `lib/contacts.ts`** — código completo que *ningún componente invoca*
   en 1.5.66 (F V-1): maquinaria dormida sin superficie; no se enseña lo que el usuario no puede
   tocar. Si un día se conecta, el diff de cobertura lo marcará en esa ola.
2. **Las fotos de la ficha** — apagadas por bandera (`PHOTOS_ENABLED = false`, decisión 2026-10-31):
   sin UI viva no hay lección; las fotos de cortes en el Historial sí viven y se enseñan en AD2.
3. **`completeTodayJobs`** — función de servidor sin llamador en la UI (D VERIFY): maquinaria pura.
4. **«Agendar» una nota** — campos dormidos en el servidor, sin UI (E VERIFY): igual que (1).
5. **Superficies solo-memoria del shell (G)** — 18 puntos VERIFY: hasta contrastarlos en un aparato
   real quedan `solo-memoria-verify` en el registro; sus escenas se escriben contra código donde
   existe (puerta de rescate, DbStuck, candado: código completo) y la *colocación* de widgets se
   narra, no se actúa (OQ-1).

### 1.4 Hallazgos nombrados del censo (la verdad del código sobre la costumbre)

El censo corrige la semilla en varios puntos; el plan enseña **el código**, y estos puntos quedan
nombrados para que nadie «arregle» el plan contra la memoria:

- **H-D1 (el importante). El pago tras un perdón total no tiene puerta con su nombre.** Perdonar
  está completo en las cuatro formas (R-1…R-8). Pero tras un perdón **total** el cliente sale de
  Cobros y su Abono queda deshabilitado en la ficha: la única ruta real para declarar el pago
  tardío es **Adelanto** en la ficha → `recordPayment`, donde todo el monto cae como fila `prepaid`
  (adelanto): el saldo no revive, lo perdonado no se des-perdona, y el dinero se gasta solo en el
  próximo Hecho a deber. Además hay **doble lectura del mismo dólar**: el pago tardío SÍ cuenta en
  los totales de Cobrado (cabecera, Estudio, exportaciones, Movimientos) pero NO aparece en las
  listas de detalle «Cobrado» de Cobros (filtro local `kind === 'paid'`), y el perdón original
  sigue entero en «Perdonado este mes» (R-13). Tras un perdón **parcial**, la ruta de cobro del
  resto es la normal. AD8 enseña este camino tal cual es — con su ventanita de contexto — y la
  decisión de si el canon debería darle una puerta propia es de Oscar (OQ-5), no de este plan.
- **Deshacer no es eterno**: la semilla decía que Deshacer/Rehacer «nunca se deshabilitan y
  explican»; en 1.5.66 la barra ni se pinta sin historial y la pila (20, en memoria) muere al
  recargar (A-85, H). Pasado eso, un perdón es irreversible *en la UI* aunque el servidor sepa
  revertirlo (R-14). AD8 lo enseña como lo que es: una red con límite, no un seguro eterno.
- **El swipe de Clientes no trae WhatsApp**: deslizar revela solo Llamar + Mapa; WhatsApp/mensaje
  viven como botones visibles (I). Y `SwipeRow` es de uso único en todo `src`.
- **El pin fijado es verde** (`--tone-pin`), aunque los comentarios del código aún dicen «rosa»:
  manda la variable (A-58, H). Y hay pines **forzados por el servidor** que no se pueden quitar
  (atrasados y próximo patio de alto riesgo, A-60) — se enseña con ventanita de contexto.
- **Ajustes tiene 17 pliegues, no ~13** (F): Sonidos vive en `settings-finder.tsx` y Nube/Huella se
  montan con otro shell; censar solo `ajustes.tsx` pierde pliegues enteros. Y dentro del pliegue
  del Manual viven tres «Ajustes rápidos» que pisan horas, umbrales o temporada de un toque (F-59)
  — el ítem más escondido de Ajustes, con módulo (AD14).
- **El Panel trae 4 deudores y pinta 3** (G-11/V-4): `getNativePlan` hace `limit 4` pero el widget
  solo tiene 3 filas. Contradicción interna sin resolver: ninguna escena de AD16 afirma el número
  hasta que se resuelva si es recorte o defecto (OQ-6).
- **«Pospuesto» no es un estado y «Tarde» tampoco se guarda**: Tarde se calcula; Pospuesto es un
  pseudo-filtro local (`originDate ≠ scheduledDate` o razón) (C). AD5 enseña el modelo verdadero.
- **El domingo es día raro solo para la mano**: el generador de visitas no lo salta por defecto
  (C V-2, a contrastar con los ajustes del libro real); «Quitar vacaciones» aplica `−vacationShift`
  en bloque, contra el «devuelve los patios a sus días» del Manual (C V-4). Ambos quedan marcados
  VERIFY en sus escenas hasta el contraste en aparato (cerca F-4).
- **Widgets Semana y Panel son invisibles dentro de la app**: la única instrucción de colocación
  nombra solo al «Widget Hoy», y los tamaños 4×3/4×4 de Hoy solo se descubren *estirando* (G). Es
  el hueco de enseñanza mayor de AD16 — justo el tipo de función que la ley de escondidas existe
  para sacar a la luz.
- **La calculadora no vive en Estudio** (E): `MoneyCalc` vive en los diálogos de cobro y en el
  Bloc; Q4 y AD11 la enseñan en su casa verdadera.

---

## 2. Decisiones de puesta en escena

- **Comunicación, en dos pisos (por el peso del censo: 54 ítems).** Los botones dentro de la
  tarjeta + escribir un mensaje son del **primer día** (Q5) — nadie debería necesitar el piso
  Advanced para avisar a un cliente. El arte completo (dictado y su escalera, traducción, «A
  inglés», mensajes listos de lluvia, la doble puerta anti-cliente-equivocado) es **AD10**. Dividir
  así sigue el patrón de la casa y la ley de estructura: lo diario primero, lo premium después,
  sin abarrotar Q5.
- **El viaje del dato abre el piso Advanced (AD1)**, como la Cadena abre en Cadence y el viaje del
  dígito cierra el mapa en Faro: primero el mapa (Q1), luego el trabajo (Q3–Q5), y al entrar en lo
  avanzado, la columna que lo une todo.
- **Lo de fuera de la app (AD16) se propone como teatro + narración**, siguiendo el precedente de
  Faro para el widget: el motor levanta un escenario de pantalla de inicio y actúa sobre él **la
  pieza real** (el widget que Ajustes ya previsualiza) — no un video, no una maqueta; las puertas
  del shell (rescate, candado, recuperación) se **narran** sobre la pantalla real de la app con la
  tarjeta y sus ventanitas, porque no se pueden (ni se deben) provocar en el aparato del alumno.
  Queda como Pregunta Abierta OQ-1 porque el shell Android añade riesgo propio.
- **Cada «qué pasa después» lleva su escena, no su nota al pie**: las consecuencias son capítulos
  dentro del módulo de la acción (Hecho en Q3, Perdonar en AD8, Unir en AD3, Restaurar en AD15), y
  cuando la consecuencia no se ve en los números, la ventanita de contexto la dice (§0.4).

## 3. Preguntas abiertas (cada una con su respuesta recomendada)

- **OQ-1 · Puesta en escena del shell Android.** *Recomendada:* teatro con la pieza real para
  widgets (precedente de Faro); narración sobre la app real para puertas de rescate/candado/
  recuperación. Nunca provocar un fallo real en el aparato del alumno.
- **OQ-2 · Dónde vive el pliegue del índice en Ajustes.** Ajustes ya tiene 17 pliegues.
  *Recomendada:* el pliegue «Presentaciones» justo **encima del pliegue del Manual** — aprender a
  pedir ayuda (Manual, texto) y aprender actuando (Presentación, movimiento) quedan vecinos, como
  en Faro — y dentro del orden personalizable de pliegues como cualquier otro.
- **OQ-3 · Número y nombres de módulos.** Este plan propone 6 Quick + 16 Advanced.
  *Recomendada:* aceptar la escalera como está para la revisión; los nombres son cortos, del
  vocabulario del oficio, y cualquier renombre es de Oscar por nombre.
- **OQ-4 · El reparto ficticio.** Nombres provisionales (Don Aurelio y su ruta; casos ajustados).
  *Recomendada:* nombres corrientes y creíbles del mundo de los clientes de Brizna — sin el juego
  de pensadores famosos de Cadence, que era diversión para un público distinto; aquí el alumno debe
  reconocer *su* calle. Oscar puede fallar otra cosa.
- **OQ-5 · La puerta que falta tras el perdón total (H-D1).** El plan enseña el camino verdadero
  (Adelanto → adelanto que se gasta solo). *Recomendada:* enseñar el código tal cual es en esta
  fase; si Oscar quiere una puerta con nombre («Declarar pago» sobre saldo perdonado), eso es una
  ola del canon, fuera de esta línea, y este plan se actualiza en esa misma ola.
  **FALLADO POR OSCAR (2026-11-13 20:40 EST):** «Entonces haz los arreglos necesarios para que
  aparezca por si alguien que estaba perdonado paga.» — el arreglo va al canon (encargado a la
  línea de Brizna con el diagnóstico H-D1/H-D2 completo): el pago de un cliente perdonado debe
  APARECER como pago (en las listas de Cobrado de Cobros, no solo en los totales).
  **PUBLICADO EN EL CANON — Brizna 1.5.69 (2026-11-13, source 4cd6419, main e537d74, verificado
  en vivo por la línea del canon: sw brizna-1.5.69, precache 19/19):** las listas de Cobrado de
  Cobros (semana/mes/año) ya incluyen los pagos `prepaid`: el pago tardío del perdonado total —
  que entra por Adelanto (o Pagado con cantidad) en su ficha y queda como adelanto a favor —
  APARECE con fila propia, marcada «Adelanto» + su método; el conteo «+N más» del año usa el
  mismo predicado: totales y listas cuentan lo mismo (H-D2 cerrado). El ciclo de remisión y la
  regla de totales únicos no se tocaron. El Manual (Perdonar y Cobrado, ES+EN) ya enseña la
  puerta en la misma ola. Declarado: la sonda de banco no completó el arranque en perfil fresco
  esa noche (ambiente lento); puertas de código verdes (typecheck + suite 74/74); el veredicto
  final es el teléfono de Oscar. **AD8 se escribe contra esta verdad 1.5.69** (la copia aislada
  sigue en 1.5.66: al construir AD8 se trae primero el delta del canon o se guiona contra esta
  descripción verificada, marcándolo según la cerca F-4).
- **OQ-6 · El Panel: ¿4 deudores o 3?** Contradicción código↔widget (G V-4). *Recomendada:*
  resolverla en el canon antes de escribir la escena de AD16; mientras tanto la escena no afirma
  el número (cerca F-4 lo impide).
- **OQ-7 · Nombre del paso de ventanita.** Propuesto: `contexto`. *Recomendada:* `contexto` —
  corto, del vocabulario de Oscar («para que todo se entienda bajo contexto»).
- **OQ-8 · La cadena de primera vez.** Faro ordenó la oferta de huella antes que la de la
  Presentación. *Recomendada:* la misma cadena aquí (registro → oferta de huella → oferta de la
  Presentación → Q1 → índice), ofrecida una vez, nunca impuesta; declinar es final y silencioso.

---

## 4. Qué no hace esta fase

No se ha construido ninguna escena, ningún motor ni ningún ancla `data-present`; no se ha tocado el
canon (`~/workspace/brizna-work`, sellado 1.5.09, ni el árbol 1.5.66 de origen — la copia es copia).
Los puntos marcados VERIFY a lo largo del censo (A: 3 · B: 6 · C: 8 · D: 6 · E: 7 · F: 7 · G: 18 ·
H: 5 · I: 7) son la lista de contraste en aparato que la fase de construcción debe quemar antes de
que sus escenas se escriban como hechos (cerca F-4). La puerta siguiente es el fallo de Oscar
sobre este plan.
