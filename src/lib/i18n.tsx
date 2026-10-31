import { cloneElement, createContext, Fragment, isValidElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { NameLink, nameDest } from "@/components/name-jump";
import { applyLocale, readStoredLocale } from "@/lib/theme";
import type { LocaleName } from "@/lib/types";

const es = {
  "nav.today": "Hoy",
  "nav.agenda": "Agenda",
  "nav.clients": "Clientes",
  "nav.payments": "Cobros",
  "nav.stats": "Cifras",
  "nav.notes": "Notas",
  "nav.settings": "Ajustes",
  "common.back": "Atrás",
  "common.save": "Guardar",
  "common.wait": "Espera…",
  "common.close": "Cerrar",
  "common.more": "Más en el manual",
  "hint.label": "¿Qué significa esto?",
  "photo.gallery": "Galería",
  "photo.camera": "Tomar foto",
  "photo.job": "Foto del patio, si hace falta",
  "photo.ready": "Foto lista. Se guarda con la fecha de este trabajo.",
  "photo.fail": "Esa foto no se pudo guardar. Prueba otra más pequeña.",
  "hecho.title": "¿Cómo cerrar este corte?",
  "hecho.paid": "Hecho y cobrado",
  "hecho.owe": "Hecho y pendiente",
  "hecho.abono": "Hecho y abonado",
  "hecho.paidHelp": "Verde. Anota el pago de hoy en Cobrado. Lo que debía de antes sigue en Por cobrar.",
  "hecho.oweHelp": "Rojo. El corte queda hecho y el monto entra en Por cobrar. No se cuenta como cobrado.",
  "hecho.abonoHelp": "Amarillo. Anota solo una parte. Lo que no cubra sigue en Por cobrar.",
  "stop.button": "Parar por lluvia",
  "stop.title": "¿Parar los pendientes de hoy?",
  "stop.help": "Parar por lluvia viene preestablecido. También puedes parar por otra razón. Se guarda la hora exacta y los patios pasan al siguiente día abierto.",
  "stop.rain": "Sí, paro por lluvia",
  "stop.other": "Sí, paso por esta razón",
  "stop.msgRain": "Hola. Por la lluvia no pude pasar hoy.",
  "stop.msgOther": "Hola. Hoy no pude pasar.",
  "hours.title": "Horas de trabajo",
  "hours.in": "Entrada",
  "hours.out": "Salida",
  "hours.now": "Ahora",
  "hours.preset": "Horario de siempre",
  "hours.confirm": "Sí, trabajé esas horas",
  "hours.confirmed": "Día confirmado",
  "hours.ask": "¿Trabajaste de {in} a {out}?",
  "hours.yesterday": "¿Ayer trabajaste de {in} a {out}?",
  "hours.yesterdayHelp": "Ayer no se confirmó el horario. Si hoy no lo confirmas, se añade solo el de siempre.",
  "hours.later": "Después",
  "hours.unconfirmed": "Sin confirmar",
  "hours.auto": "Si no cambias la hora, queda el horario de Ajustes.",
  "notes.title": "Bloc de notas",
  "notes.search": "Buscar texto, @cliente o #etiqueta",
  "notes.empty": "Ninguna nota con eso.",
  "notes.pin": "Fijar",
  "notes.unpin": "Quitar fijado",
  "notes.tags": "Etiquetas",
  "notes.tagPh": "Nueva etiqueta",
  "notes.when": "Agendar",
  "notes.also": "También en un cliente",
  "notes.kept": "Sigue en el bloc general.",
  "notes.saved": "Guardado",
  "notes.saving": "Guardando…",
  "notes.new": "Nueva nota",
  "notes.delete": "Borrar nota",
  "notes.folder": "Carpeta",
  "notes.noFolder": "Sin carpeta",
  "notes.placeholder": "Recordatorios, materiales, recados…",
  "notes.correct": "Corregir",
  "notes.mention": "Mencionar cliente",
  "week.fromToday": "Hoy va primero. Después van los seis días siguientes.",
  "stats.hoursToday": "Horas hoy",
  "stats.hoursWeek": "Horas esta semana",
  "stats.hoursMonth": "Horas este mes",
  "stats.stops": "Días parados",
  "lang.es": "Español",
  "lang.en": "English",
  "theme.light": "Claro",
  "theme.amoled": "Amoled",
  "palette.jardin": "Jardín",
  "palette.costa": "Costa",
  "palette.barro": "Barro",
  "palette.pino": "Pino",
  "palette.cielo": "Cielo",
  "stop.come": "Voy el {date}.",
  "stop.moved": "{n} patios pasados al {date}.",
  "stop.none": "Hoy no había patios pendientes.",
  "stop.fail": "No se pudieron pasar los patios.",
  "density.label": "Tamaño de tarjetas",
  "density.full": "Grande",
  "density.compact": "Media",
  "density.dense": "Lista",
  "density.quad": "Malla",
  "notes.week": "Esta semana",
  "notes.weekHelp": "Toca un día para ver los patios. Hoy va primero y después los seis días siguientes.",
  "notes.noneDay": "Nada pendiente este día.",
  "notes.yard": "patio",
  "notes.yards": "patios",
  "notes.deleteAsk": "¿Borrar esta nota?",
  "notes.deleteHelp": "Solo se borra esta hoja. Las demás se quedan.",
  "notes.deleted": "Nota borrada",
  "notes.keepOne": "Deja al menos una nota",
  "notes.saveFail": "No se pudieron guardar las notas",
  "notes.move": "Mover",
  "notes.newFolder": "Nueva carpeta",
  "notes.titleLabel": "Título de la nota",
  "notes.linked": "También en el bloc general",
  "common.cancel": "Cancelar",
  "common.confirm": "Confirmar",
  "common.delete": "Borrar",
};

const en: Record<keyof typeof es, string> = {
  "nav.today": "Today",
  "nav.agenda": "Schedule",
  "nav.clients": "Clients",
  "nav.payments": "Payments",
  "nav.stats": "Figures",
  "nav.notes": "Notes",
  "nav.settings": "Settings",
  "common.back": "Back",
  "common.save": "Save",
  "common.wait": "Wait…",
  "common.close": "Close",
  "common.more": "More in the manual",
  "hint.label": "What does this mean?",
  "photo.gallery": "Gallery",
  "photo.camera": "Take photo",
  "photo.job": "Yard photo, if you need one",
  "photo.ready": "Photo ready. It is saved with this job's date.",
  "photo.fail": "That photo could not be saved. Try a smaller one.",
  "hecho.title": "How should this cut be closed?",
  "hecho.paid": "Done and paid",
  "hecho.owe": "Done and unpaid",
  "hecho.abono": "Done with a partial payment",
  "hecho.paidHelp": "Green. Records today's payment under Collected. Older debt stays in To collect.",
  "hecho.oweHelp": "Red. The cut is done and the amount goes to To collect. It is not counted as collected.",
  "hecho.abonoHelp": "Yellow. Records only part of the money. The rest stays in To collect.",
  "stop.button": "Stop for rain",
  "stop.title": "Stop today's pending yards?",
  "stop.help": "Stop for rain is the preset. You can also stop for another reason. The exact time is saved and the yards move to the next open day.",
  "stop.rain": "Yes, stopping for rain",
  "stop.other": "Yes, stopping for this reason",
  "stop.msgRain": "Hello. I could not come today because of the rain.",
  "stop.msgOther": "Hello. I could not come today.",
  "hours.title": "Work hours",
  "hours.in": "Clock in",
  "hours.out": "Clock out",
  "hours.now": "Now",
  "hours.preset": "Usual hours",
  "hours.confirm": "Yes, I worked those hours",
  "hours.confirmed": "Day confirmed",
  "hours.ask": "Did you work from {in} to {out}?",
  "hours.yesterday": "Did you work yesterday from {in} to {out}?",
  "hours.yesterdayHelp": "Yesterday was not confirmed. If you do not confirm it today, the usual hours are added on their own.",
  "hours.later": "Later",
  "hours.unconfirmed": "Not confirmed",
  "hours.auto": "If you do not change the time, the hours from Settings are used.",
  "notes.title": "Notepad",
  "notes.search": "Search text, @client, or #tag",
  "notes.empty": "No note matches that.",
  "notes.pin": "Pin",
  "notes.unpin": "Unpin",
  "notes.tags": "Tags",
  "notes.tagPh": "New tag",
  "notes.when": "Schedule",
  "notes.also": "Also on a client",
  "notes.kept": "It stays in the main notepad.",
  "notes.saved": "Saved",
  "notes.saving": "Saving…",
  "notes.new": "New note",
  "notes.delete": "Delete note",
  "notes.folder": "Folder",
  "notes.noFolder": "No folder",
  "notes.placeholder": "Reminders, materials, errands…",
  "notes.correct": "Correct",
  "notes.mention": "Mention a client",
  "week.fromToday": "Today comes first. The next six days follow.",
  "stats.hoursToday": "Hours today",
  "stats.hoursWeek": "Hours this week",
  "stats.hoursMonth": "Hours this month",
  "stats.stops": "Stopped days",
  "lang.es": "Español",
  "lang.en": "English",
  "theme.light": "Light",
  "theme.amoled": "Amoled",
  "palette.jardin": "Garden",
  "palette.costa": "Coast",
  "palette.barro": "Clay",
  "palette.pino": "Pine",
  "palette.cielo": "Sky",
  "stop.come": "I will come on {date}.",
  "stop.moved": "{n} yards moved to {date}.",
  "stop.none": "There were no pending yards today.",
  "stop.fail": "The yards could not be moved.",
  "density.label": "Card size",
  "density.full": "Large",
  "density.compact": "Medium",
  "density.dense": "List",
  "density.quad": "Mesh",
  "notes.week": "This week",
  "notes.weekHelp": "Tap a day to see its yards. Today comes first, then the next six days.",
  "notes.noneDay": "Nothing pending that day.",
  "notes.yard": "yard",
  "notes.yards": "yards",
  "notes.deleteAsk": "Delete this note?",
  "notes.deleteHelp": "Only this page is deleted. The others stay.",
  "notes.deleted": "Note deleted",
  "notes.keepOne": "Keep at least one note",
  "notes.saveFail": "The notes could not be saved",
  "notes.move": "Move",
  "notes.newFolder": "New folder",
  "notes.titleLabel": "Note title",
  "notes.linked": "Also in the main notepad",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.delete": "Delete",
};

export type MsgKey = keyof typeof es;

export type ManualSection = {
  id: string;
  title: string;
  body: string;
  points?: { id: string; body: string }[];
};

export const MANUAL: Record<LocaleName, ManualSection[]> = {
  es: [
    {
      id: "hoy",
      title: "Hoy",
      body: "Hoy es el día de trabajo. El día de hoy va primero y después siguen los seis días siguientes, sea lunes o viernes. Lo atrasado se queda arriba hasta que lo resuelvas. En Malla, las casillas tienen las puntas suaves y redondeadas.",
    },
    {
      id: "vistas",
      title: "Vistas",
      body: "Grande, Media, Lista y Malla van en ese orden, a lo ancho de la pantalla. Cada pantalla recuerda la última: Hoy, Clientes, Agenda, Cobros, la ficha y el Fichero no se pisan. Malla empieza en 2 columnas. El siguiente toque pone 3, el otro 4, y vuelve a 2. El alto de cada casilla se queda fijo. En 2 hay un poco de detalle y algunas acciones. En 3, menos. En 4, solo el nombre.",
      points: [
        {
          id: "vistas-clientes",
          body: "Clientes, Lista: el precio va en la misma línea del nombre, sin iconos de contacto. Media muestra los iconos de contacto y un resumen del saldo. Grande enseña la tarjeta con todos los datos.",
        },
        {
          id: "vistas-cobros",
          body: "Cobros usa las mismas vistas. Lista deja Pagado junto al nombre. Media añade Abono. Grande muestra el corte, el atraso y Perdonar. Malla recorta hasta dejar el nombre.",
        },
      ],
    },
    {
      id: "hecho",
      title: "Hecho",
      body: "Hecho cierra un patio. Hay tres caminos. Hecho y cobrado es verde: anota el pago de hoy en Cobrado y deja lo anterior en Por cobrar. Hecho y pendiente es rojo: el monto entra en Por cobrar. Hecho y abonado es amarillo: anotas solo una parte y el resto sigue por cobrar.",
    },
    {
      id: "lluvia",
      title: "Parar el día",
      body: "Parar por lluvia mueve los pendientes de hoy al siguiente día abierto. Parar por lluvia viene preestablecido. También puedes parar por visita al médico, dentista u otra razón escrita a mano. Se guarda la hora exacta. Cifras cuenta esos días en Días parados.",
    },
    {
      id: "horas",
      title: "Horas",
      body: "La entrada de siempre es a las 8:00 y la salida a las 5:30. Cámbialas en Ajustes. Desde Hoy, cambiar la entrada o la salida pide confirmación: ahora, o el horario de siempre. Las flechas deshacen y rehacen. Al final, Sí, trabajé esas horas confirma, y No, editar deja corregir la hora. Cifras suma el día, la semana y el mes.",
    },
    {
      id: "notas",
      title: "Bloc de notas",
      body: "El texto no se guarda solo: escribes y tocas Guardar. El más, en el bloc, en la carpeta madre y dentro de una carpeta, abre una nota en blanco para que escribas primero; no crea una nota vacía hasta que guardas. Desde una carpeta, queda en esa carpeta. Desde la carpeta madre, queda en No especificada. Al guardar, pregunta si vas a esa carpeta o empiezas otra nota limpia. Si el texto y el título ya están en otra nota, avisa antes de duplicar. Toda nota entra en una carpeta: Trabajo por hacer, Materiales, Recordatorios, No especificada, o una nueva. En el Fichero, fuera de las carpetas, solo se ven las notas fijadas. Dentro de su carpeta están todas. El Fichero se abre con doble toque en el icono de notas. El botón se llama Bloc, también dentro de una carpeta, y abre el bloc. Dentro, la flecha dice Abrir bloc y vuelve. La calculadora, junto al pin, saca la cuenta sola. En la nota la escribe en la nota. Se puede bajar del asa, también con el teclado abierto, y achicarla de la esquina; al cerrarla vuelve a su sitio. Al entrar desde Hoy u otra pestaña, el bloc abre una nota nueva. Si pasas al Fichero, esa nota se queda. Una nota nueva desde una carpeta no la borra. Solo al salir del bloc, hacia Hoy u otra pestaña, pregunta qué hacer con lo que no guardaste. Las fijadas salen aparte. Doble toque en una nota abre el editor. Para leer, abre el Fichero. En el Fichero, deslizar a la derecha mueve la nota de carpeta y a la izquierda la manda a la papelera. El pin queda a la derecha de la nota. Grande enseña un poco más, no la nota entera. En la carpeta madre, el embudo de Filtros va en la misma línea que Bloc. Al abrir una carpeta, el embudo se queda debajo. El bloc tiene un halo del color del tema. Esta semana se pliega, y el pin la deja abierta. Escribe @ y elige el cliente: la nota queda en su ficha. Fijar la deja también en Hoy.",
      points: [
        {
          id: "notas-etiquetas",
          body: "Carpetas: se crean, se renombran y se borran en el engranaje del Fichero. No especificada guarda lo que no encaja en las demás.",
        },
        {
          id: "notas-agenda",
          body: "Fijar: la nota queda marcada y aparece en Hoy como recordatorio. Ya no se agenda con fecha y hora. @Nombre deja la nota en ese cliente al guardar.",
        },
      ],
    },
    {
      id: "cobros",
      title: "Cobros",
      body: "Por cobrar es el dinero que todavía deben. Abonado está en el mismo recuadro: quien dejó una parte y todavía debe, para darles seguimiento. El número de personas se toca y abre la lista. Si pagan toda la deuda, salen de Abonado. Cobrado es lo que ya entró en la semana, el mes o el año. Trabajo ya hecho, En espera y Perdonado este mes se pliegan. El pin de la esquina deja uno abierto siempre. La función Perdonar es lo único que saca un saldo sin un pago. En Por cobrar, Grande y Media, las dos rayitas pausan el patio mientras pagan. La función Continuar vuelve a poner el patio en la agenda. Siempre pregunta antes.",
      points: [
        {
          id: "cobros-por-cobrar",
          body: "Por cobrar: el saldo que todavía te deben. Toca el número y ves a esas personas. Si se atrasan, siguen aquí: no se perdonan solas.",
        },
        {
          id: "cobros-abonado",
          body: "Abonado: quien dejó una parte y todavía debe. Sirve para darles seguimiento. Si pagan toda la deuda, salen de aquí.",
        },
        {
          id: "cobros-corriente",
          body: "Al corriente con saldo: deben, pero todavía no llegan a En espera ni a Alto riesgo.",
        },
        {
          id: "cobros-perdonar",
          body: "Perdonar: dinero que decidiste no cobrar. Sale de Por cobrar. No es un atraso. Un atraso se queda en En espera.",
        },
      ],
    },
    {
      id: "cifras",
      title: "Cifras",
      body: "Cifras mira el tiempo, no el cobro del momento. La lupa busca una cifra sin ocupar todo el ancho. Cada bloque se pliega, y el pin lo deja abierto siempre. La palomilla de arriba despliega todo de una vez; si la quitas, se pliega. Junto al título Estadísticas hay un botón de orden. Sube o baja cada bloque y confirma con Guardar. Cancelar no cambia nada. El orden de siempre es Números, después Esta semana frente a la anterior, luego Horas de trabajo y debajo Días del año. De por vida son dos cuentas juntas: el dinero de Cobrado desde el primer pago, y los patios en Hecho desde el primero. No son la misma cosa. El promedio suma y divide. La mediana es el punto medio, no el promedio. El ticket es lo cobrado este año dividido entre los patios hechos. Las propinas se cuentan aparte y no inflan Cobrado. Días del año compara trabajo y descanso. La palomilla de Días del año deja fuera el día que casi nunca se trabaja, para ver solo los días hábiles.",
      points: [
        {
          id: "cifras-semana",
          body: "Patios esta semana: los patios marcados Hecho en esta semana, de lunes a domingo.",
        },
        {
          id: "cifras-semana-pasada",
          body: "Patios semana pasada: la misma cuenta, pero de la semana anterior.",
        },
        {
          id: "cifras-promedio",
          body: "Promedio por semana: suma los patios de las últimas 4 semanas y los divide entre 4.",
        },
        {
          id: "cifras-mediana",
          body: "Mediana por semana: el punto medio de esas semanas. No es el promedio: un día enorme no lo empuja.",
        },
        {
          id: "cifras-ticket",
          body: "Ticket promedio: lo cobrado este año dividido entre los patios hechos.",
        },
        {
          id: "cifras-cobrado-semana",
          body: "Cobrado, promedio semanal: el dinero de Cobrado de las últimas 4 semanas, dividido entre 4.",
        },
        {
          id: "cifras-vida-dinero",
          body: "Dinero de por vida: todo el dinero que ya te pagaron desde el primer cobro. Suma Cobrado de todos los años, no solo este. No es la cuenta de patios de al lado. Lo que sigue en Por cobrar no entra. Las propinas se cuentan aparte.",
        },
        {
          id: "cifras-vida-patios",
          body: "Patios de por vida: cuántos patios quedaron en Hecho, del primero al último. Es una cuenta de patios, no de dinero. Un patio sin pagar también cuenta.",
        },
        {
          id: "cifras-orden",
          body: "Orden de las cifras: el botón junto a Estadísticas. Sube o baja cada bloque. Guardar pregunta antes de dejar ese orden. Cancelar no cambia nada. Orden de siempre prepara Números, Esta semana frente a la anterior, Horas de trabajo y, debajo, Días del año. Hay que guardar para que quede.",
        },
      ],
    },
    {
      id: "agenda",
      title: "Agenda y calendario",
      body: "Agenda es la lista. Arriba, fijos, están Calendario, Semana, Mes y Todo: eligen el período. Abajo están Pendiente, Tarde, Realizado, Pospuesto y Cancelado: eligen el estado. Van juntos. Realizado con Semana es lo hecho esta semana. Con Mes, lo hecho este mes. Con Todo, todo lo ya hecho. Con Calendario, esos días quedan marcados y se puede cambiar de mes. Todo, con Pendiente, cuenta los patios pendientes y suma lo que valdrían si se hacen. No es dinero ya cobrado. El número de clientes y el dinero si cada uno pagara una vez están en Clientes, en Activos, y con más detalle en Inventario de clientes. Pospuesto deja los patios movidos del período de arriba y la razón de cada día. El día que casi nunca se trabaja, suele ser el domingo, sigue libre: la agenda automática no pone cortes regulares ahí. Un patio pospuesto a mano para ese día, o un trabajo extra o de una vez, sí se queda y entra en las cifras como un día hábil de más. El resto de esos días no se vuelven normales.",
      points: [
        {
          id: "agenda-todo",
          body: "Todo, con Pendiente, son los patios pendientes de toda la agenda y la suma de lo que valen si se hacen. No es dinero ya cobrado. Cuántos clientes hay, y el dinero si cada uno pagara una vez, está en Clientes, en Activos, y con el detalle en Inventario de clientes.",
        },
        {
          id: "agenda-dia",
          body: "Este recuadro aparece en esa fecha, dentro de la agenda, solo si el día no siguió con normalidad. La razón sale de Parar el día: lluvia, que viene preestablecida, una visita al médico, el dentista, u otra escrita a mano. Si unos patios se movieron, su nombre queda junto a la razón. Esos pendientes pasan al siguiente día abierto y se guarda la hora. Un día trabajado como siempre no muestra el recuadro. En Cifras, las mismas razones se cuentan en Días parados.",
        },
      ],
    },
    {
      id: "clientes",
      title: "Clientes",
      body: "Los filtros de Clientes están en un embudo. Sirven para ver un tipo de cliente: los de la ruta, los de cada semana, los que deben y los casos aparte. Cada uno trae su explicación. En el inventario, Permanentes corta cada semana. Una vez no se repite. Juntos cuenta los dos. Archivos está dado de baja. Al añadir varios desde el teléfono, los precios que más usas salen en pequeño. Si Paga el mismo día está vacío, cada corte suma a la deuda.",
    },
    {
      id: "fotos",
      title: "Fotos",
      body: "Al marcar Hecho puedes tomar una foto o elegirla de la galería del teléfono. Galería abre las fotos. Cámara abre la cámara. Se guarda en ese corte, con la fecha. En la ficha, Fotos de la ficha y el historial dejan verla grande, compartirla con un cliente o con otra persona, y quitarla solo después de confirmar.",
    },
    {
      id: "idioma",
      title: "Idioma y colores",
      body: "Español es el idioma de siempre. English cambia los textos y el corrector del bloc. En Tema, Día y Noche tienen temas distintos. Automático cambia según la hora: de noche antes de las 6:30 y desde las 6:30 de la tarde. Tú eliges el tema de día y el de noche. Jardín, Costa, Barro, Pino, Cielo, Lima, Arena y Flor son de día. Bosque, Mar, Brasa, Tinta, Luna y AMOLED son de noche. Solo cambian los colores. El tema elegido se queda, aunque bajes la pantalla para refrescar, hasta que lo cambies.",
    },
    {
      id: "ajustes",
      title: "Ajustes usuales",
      body: "Semana normal deja la entrada a las 8:00, la salida a las 5:30, En espera a los 45 días, Alto riesgo a los 21 días o $200, y 3 cortes sin pagar. Cada ajuste se pliega. El pin lo deja abierto la próxima vez. Desplegar todo abre todos los ajustes a la vez. La lupa de Ajustes deja solo el ajuste que coincide. Modo tableta, en pantallas grandes, parte la vista en dos, tres o cuatro pestañas y deja cambiar su orden. Si está apagado, la pantalla sigue de una en una.",
    },
    {
      id: "sesion",
      title: "Sesión",
      body: "En Entrar, Mantener sesión abierta deja la cuenta abierta hasta que cierres sesión. Si la casilla está vacía, la sesión se acaba al salir de la app. Con el correo y la contraseña la casilla manda. Google y X se quedan dentro hasta que cierres sesión.",
    },
    {
      id: "todos",
      title: "Todos",
      body: "Todos, al final del día, pregunta quién pagó y quién abonó entre los patios de hoy. El resto queda pendiente y entra en Cobros. No hay que ir uno por uno si ya cerraste la ruta. Al terminar suena un ding suave, si los sonidos están encendidos.",
    },
    {
      id: "espera",
      title: "Espera y alto riesgo",
      body: "Ejemplo: un cliente debe $80 desde hace 50 días. Con 45 días de espera, está En espera: se atrasó, pero va a pagar, y el dinero sigue en Por cobrar. Si pasan 21 días de atraso, la deuda llega a $200, o ya van 3 cortes sin pagar, pasa a Alto riesgo, en naranja. Basta con uno de esos límites. La función Perdonar es la única forma de borrar el saldo sin un pago. Quien está pagando y no debe recibir cortes va aquí también: las dos rayitas lo pausan y la función Continuar vuelve a poner el patio en la agenda. La ficha del cliente tiene los mismos botones.",
      points: [
        {
          id: "fiabilidad",
          body: "Fiabilidad de pago: mide si la persona paga a tiempo y si el saldo se pasó de los días, del monto o de los cortes que tú marcaste en Ajustes. No es el mismo número que Por cobrar.",
        },
        {
          id: "en-espera",
          body: "En espera: siguen debiendo y se atrasaron, pero todavía no llegan al límite naranja. El dinero no sale de Por cobrar.",
        },
        {
          id: "alto-riesgo",
          body: "Alto riesgo: se pasaron de los días, del monto o de los cortes sin pagar que pusiste en Ajustes. Quedan en naranja y siguen en Por cobrar. También salen en Clientes. Solo la función Perdonar borra el saldo sin un pago.",
        },
        {
          id: "pausa",
          body: "Pausa: dos rayitas, como un control. No se le hará cortes ni trabajos hasta que decidas Continuar. Lo que debe se queda en Por cobrar y el caso queda en En espera, aunque todavía no llegue a los días de atraso. En Por cobrar sale en Grande y Media. También está en la ficha. Siempre hay una ventana de confirmación.",
        },
      ],
    },
    {
      id: "temporada",
      title: "Temporada para todos",
      body: "Ejemplo: de 11-01 a 02-28, cada 21 días. En invierno el césped crece menos, así que todos los cortes regulares se espacian, sin reescribir cada ficha. Un cliente puede tener su propio ritmo. Los patios que ya moviste a mano no vuelven al día viejo. Los meses por delante deciden hasta cuándo se arma la agenda.",
    },
    {
      id: "propina",
      title: "Propina",
      body: "Si alguien da más de lo que debe, anótalo como propina al marcar Hecho o al cobrar. La propina no baja ni sube la deuda y no entra en Cobrado. Cifras la suma en el mes y en el año.",
      points: [
        {
          id: "propina-anio",
          body: "Propinas del año: el dinero de más de todo el año. No cambia la deuda y no entra en Cobrado.",
        },
        {
          id: "propina-mes",
          body: "Propinas del mes: las propinas de este mes, aparte de Cobrado.",
        },
      ],
    },
    {
      id: "precio",
      title: "Precio después de hecho",
      body: "Ejemplo: el corte decía $40 y al terminar fueron $55. En el historial del cliente, toca el precio, escribe 55 y guarda. La cuenta sube $15. Si el precio baja y la cuenta quedaría en negativo, lo que sobra pasa a adelanto.",
    },
    {
      id: "ritmo",
      title: "Días del año",
      body: "La barra pequeña compara días con horas de trabajo y días de descanso. La palomilla No contar el día que casi nunca se trabaja deja fuera ese día, que suele ser el domingo. Un día a medias cuenta sus horas exactas. El año, en la misma línea del título, deja comparar este año con los anteriores. ¿Por qué no se trabajó? lista las razones y cuántas veces salió cada una. Los doce bloques son los meses: el número de arriba es el mes y el de abajo, más pequeño, cuántos días hábiles no se trabajaron. Toca un mes para leer la frase.",
    },
    {
      id: "sonidos",
      title: "Sonidos",
      body: "Cuando Todos termina, suena un ding corto. Cada Hecho suena más bajito. En Ajustes, Sonidos, se apagan o se baja el volumen. No hay un botón flotando en la pantalla.",
    },
    {
      id: "busca",
      title: "Buscar en Ajustes",
      body: "La lupa está en la línea de Ajustes. Si escribes Manual, se queda solo el manual. Si escribes hor o hras, se queda Horas de trabajo. Lo demás se esconde, como en los ajustes del teléfono. Cada bloque se pliega, y el pin lo deja abierto.",
    },
    {
      id: "una-vez",
      title: "Patio de una vez",
      body: "En ¿Qué hay que hacer? salen opciones frecuentes, como un corte o una limpieza. Tócalas para llenar el texto, o edítalas a mano y escribe otra.",
    },
  ],
  en: [
    {
      id: "hoy",
      title: "Today",
      body: "Today is the working day. Today comes first, then the next six days, whether it is Monday or Friday. Late yards stay at the top until you clear them. In Mesh, the tiles have soft rounded corners.",
    },
    {
      id: "vistas",
      title: "Views",
      body: "Large, Medium, List, and Mesh go in that order, across the width of the screen. Each screen remembers its own: Today, Clients, Schedule, Payments, the file, and the cabinet do not overwrite each other. Mesh starts at 2 columns. The next tap is 3, the next is 4, then it returns to 2. Each tile keeps a fixed height. At 2 there is a little detail and some actions. At 3, less. At 4, only the name.",
      points: [
        {
          id: "vistas-clientes",
          body: "Clients, List: the price sits on the same line as the name, without contact icons. Medium shows the contact icons and a short balance. Large shows the full card.",
        },
        {
          id: "vistas-cobros",
          body: "Payments uses the same views. List keeps Paid next to the name. Medium adds Partial. Large shows the cut, the lateness, and Forgive. Mesh trims down to the name.",
        },
      ],
    },
    {
      id: "hecho",
      title: "Done",
      body: "Done closes a yard. There are three paths. Done and paid is green: it records today's payment under Collected and leaves older debt in To collect. Done and unpaid is red: the amount goes to To collect. Done with a partial payment is yellow: you record only part, and the rest stays to collect.",
    },
    {
      id: "lluvia",
      title: "Stop the day",
      body: "Stop for rain moves today's pending yards to the next open day. Stop for rain is the preset. You can also stop for a doctor visit, the dentist, or a reason you type. The exact time is saved. Figures counts those days under Stopped days.",
    },
    {
      id: "horas",
      title: "Hours",
      body: "The usual clock-in is 8:00 and clock-out is 5:30. Change them in Settings. If you do not change the time, the day uses that schedule on its own. Clock in now and Clock out now store the real time. At the end you confirm that you worked those hours. Figures adds the day, the week, and the month.",
    },
    {
      id: "notas",
      title: "Notepad",
      body: "Text does not save itself: you write, then tap Save. The plus, in the notepad, on the mother folder, and inside a folder, opens a blank note so you can write first; it does not create an empty note until you save. From a folder, it stays in that folder. From the mother folder, it stays in Unspecified. After saving, it asks whether to open that folder or start another clean note. If the text and title already match another note, it warns before you duplicate. Every note goes into a folder: To do, Materials, Reminders, Unspecified, or a new one. On the cabinet home, outside the folders, only pinned notes show. Inside their folder, all of them show. Double-tap the notes icon to open the cabinet. The button is called Pad, inside a folder too, and it opens the notepad. Inside, the arrow says Open pad and goes back. The calculator, next to the pin, works out the amount on its own. Into note writes it into the note. Drag the handle to float it, even with the keyboard open, and shrink it from the corner; closing puts it back. Opening the pad from Today or another tab starts a new note. Opening the cabinet keeps that note. A new note started from a folder does not erase it. Only leaving the notepad, for Today or another tab, asks what to do with what you have not saved. Pinned notes sit apart. Double-tap a note to open the editor. To read, open the cabinet. In the cabinet, swipe right to move the note to another folder and swipe left to trash. The pin sits on the right of the note. Large shows a little more, not the whole note. On the mother folder, the Filters funnel sits on the same line as Pad. Inside a folder, the funnel stays below. The pad has a glow in the theme color. This week folds, and the pin keeps it open. Type @ and pick the client: the note is saved on their file. Pin also shows it on Today.",
      points: [
        {
          id: "notas-etiquetas",
          body: "Folders: create, rename, and delete them with the gear in the cabinet. Unspecified holds what does not fit the others.",
        },
        {
          id: "notas-agenda",
          body: "Pin: the note is marked and shows on Today as a reminder. It is no longer scheduled with a date and time. @Name puts the note on that client when you save.",
        },
      ],
    },
    {
      id: "cobros",
      title: "Payments",
      body: "To collect is money still owed. Partial paid sits in that same card: someone who left part of the debt and still owes, so you can follow up. The number of people opens the list. If they pay the whole debt, they leave Partial paid. Collected is what already came in this week, month, or year. Work already done, Waiting, and Forgiven this month fold closed. The pin in the corner keeps one open. The Forgive function is the only way to clear a balance without a payment. In To collect, Large and Medium, the two bars pause the yard while they pay. The Play function puts the yard back on the schedule. It always asks first.",
      points: [
        {
          id: "cobros-por-cobrar",
          body: "To collect: the balance they still owe you. Tap the number to see those people. If they fall behind, they stay here.",
        },
        {
          id: "cobros-abonado",
          body: "Partial paid: someone who left part of the debt and still owes. If they pay the whole debt, they leave this list.",
        },
        {
          id: "cobros-corriente",
          body: "Current with a balance: they owe, but they are not yet in Waiting or High risk.",
        },
        {
          id: "cobros-perdonar",
          body: "Forgive: money you decided not to collect. It leaves To collect. It is not a late payment. A late payment stays in Waiting.",
        },
      ],
    },
    {
      id: "cifras",
      title: "Figures",
      body: "Figures looks at time, not the payment you are taking right now. The magnifying glass searches a figure without a full-width bar. Each block folds closed, and the pin keeps one open. The check at the top expands everything at once; clear it and they fold closed. Next to the Statistics title there is an order button. Move each block up or down and confirm with Save. Cancel changes nothing. The usual order is Numbers, then This week versus the previous one, then Work hours, and Days in the year under that. Lifetime is two counts side by side: Collected money since the first payment, and yards marked Done since the first one. They are not the same thing. The average adds and divides. The median is the middle point, not the average. The ticket is this year's collected money divided by finished yards. A tip is counted apart and does not inflate Collected. Days in the year compares work and rest. The check on Days in the year leaves out the day that is almost never worked, so you only see business days.",
      points: [
        { id: "cifras-semana", body: "Yards this week: yards marked Done this week, Monday through Sunday." },
        { id: "cifras-semana-pasada", body: "Yards last week: the same count, for the previous week." },
        { id: "cifras-promedio", body: "Average per week: adds the yards from the last 4 weeks and divides by 4." },
        { id: "cifras-mediana", body: "Median per week: the midpoint of those weeks. One huge day does not push it." },
        { id: "cifras-ticket", body: "Average ticket: collected this year divided by the yards done." },
        { id: "cifras-cobrado-semana", body: "Collected, weekly average: collected money from the last 4 weeks, divided by 4." },
        {
          id: "cifras-vida-dinero",
          body: "Lifetime money: all the money already paid to you since the first payment. It adds up Collected from every year, not just this one. It is not the yard count beside it. What is still in To collect does not count. Tips are counted apart.",
        },
        {
          id: "cifras-vida-patios",
          body: "Lifetime yards: how many yards were marked Done, from the first to the last. It is a count of yards, not money. A yard that is not paid yet still counts.",
        },
        {
          id: "cifras-orden",
          body: "Order of the figures: the button next to Statistics. Move each block up or down. Save asks before keeping that order. Cancel changes nothing. Usual order sets Numbers, This week versus the previous one, Work hours, and Days in the year under that. You still have to save.",
        },
      ],
    },
    {
      id: "agenda",
      title: "Schedule and calendar",
      body: "Schedule is the list. Calendar, Week, Month, and All stay fixed at the top: they pick the period. Pending, Late, Done, Postponed, and Canceled sit below: they pick the state. They work together. Done with Week is what was finished this week. With Month, what was finished this month. With All, everything already finished. With Calendar, those days are marked and you can change the month. All, with Pending, counts the pending yards and what they would be worth if they get done. It is not money already collected. The number of clients and the money if each paid once are in Clients, under Active, and in more detail in Client inventory. Postponed keeps the yards moved in the period chosen above and the reason for each day. The day that is almost never worked, usually Sunday, stays free: the automatic schedule does not put regular cuts there. A yard postponed by hand to that day, or an extra or one-time job, does stay and counts in the figures as one more business day. The other ones do not become normal work days.",
      points: [
        {
          id: "agenda-todo",
          body: "All, with Pending, is the pending yards on the whole schedule and what they are worth if they get done. It is not money already collected. How many clients there are, and the money if each paid once, is in Clients, under Active, and in detail in Client inventory.",
        },
        {
          id: "agenda-dia",
          body: "This box shows on that date, inside the schedule, only when the day did not go on as usual. The reason comes from Stop the day: rain, which is the preset, a doctor visit, the dentist, or another reason you type. If some yards were moved, their names sit next to the reason. Those pending yards go to the next open day, and the exact time is saved. A day worked as usual does not show the box. In Figures, the same reasons are counted under Stopped days.",
        },
      ],
    },
    {
      id: "clientes",
      title: "Clients",
      body: "Client filters sit in a funnel. They show one kind of client: people on the route, weekly yards, people who still owe, and the special cases. Each one has its explanation. In inventory, Regular cuts every week. One-time does not repeat. Together counts both. Archive is taken off. When you add several from the phone, the prices you use most show in small type. If Pays the same day is empty, each cut adds to the debt.",
    },
    {
      id: "fotos",
      title: "Photos",
      body: "When you mark Done you can take a photo or pick one from the phone gallery. Gallery opens the photos. Camera opens the camera. It is saved on that job, with the date. On the file, File photos and the history let you view it large, share it with a client or someone else, and remove it only after you confirm.",
    },
    {
      id: "idioma",
      title: "Language and colors",
      body: "Spanish is the default language. English changes the text and the notepad spellcheck. In Theme, Day and Night have different themes. Automatic follows the hour: night before 6:30 and from 6:30 in the evening. You choose the day theme and the night theme. Garden, Coast, Clay, Pine, Sky, Lime, Sand, and Bloom are for day. Forest, Sea, Ember, Ink, Moon, and AMOLED are for night. Colors change. The theme you pick stays, even if you pull to refresh, until you change it.",
    },
    {
      id: "ajustes",
      title: "Usual settings",
      body: "Normal week sets clock-in to 8:00, clock-out to 5:30, Waiting to 45 days, High risk to 21 days or $200, and 3 unpaid cuts. Each setting folds. The pin keeps it open next time. Expand all opens every setting at once. The Settings magnifying glass leaves only the setting that matches. Tablet mode, on large screens, splits the view into two, three, or four tabs and lets you change their order. If it is off, the screen stays one at a time.",
    },
    {
      id: "sesion",
      title: "Session",
      body: "On Sign in, Keep me signed in leaves the account open until you sign out. If the box is empty, the session ends when you leave the app. With email and password, the box decides. Google and X stay signed in until you sign out.",
    },
    {
      id: "todos",
      title: "All",
      body: "All, at the end of the day, asks who paid and who left a partial among today's yards. The rest stay unpaid and go to Payments. You do not have to do them one by one after the route is finished. A soft ding plays when it is done, if sounds are on.",
    },
    {
      id: "espera",
      title: "Waiting and high risk",
      body: "Example: a client has owed $80 for 50 days. With 45 days of waiting, they are Waiting: late, but they will pay, and the money stays in To collect. If 21 days of lateness pass, the debt reaches $200, or 3 cuts go unpaid, they become High risk, in orange. Any one of those limits is enough. The Forgive function is the only way to clear a balance without a payment. Someone who is paying and should not get cuts lives here too: the two bars pause them and the Play function puts the yard back on the schedule. The client file has the same buttons.",
      points: [
        {
          id: "fiabilidad",
          body: "Payment reliability: it measures whether the person pays on time and whether the balance went past the days, the amount, or the cuts you set in Settings. It is not the same number as To collect.",
        },
        {
          id: "en-espera",
          body: "Waiting: they still owe and fell behind, but they have not reached the orange limit yet. The money stays in To collect.",
        },
        {
          id: "alto-riesgo",
          body: "High risk: they went past the days, the amount, or the unpaid cuts you set in Settings. They turn orange and stay in To collect. They also show under Clients. Only the Forgive function clears the balance without a payment.",
        },
        {
          id: "pausa",
          body: "Pause: two bars, like a remote. No cuts or jobs until you choose to continue. What they owe stays in To collect and the case stays in Waiting, even if the late-day limit has not been reached. In To collect it shows on Large and Medium. It is also on the client file. There is always a confirmation window.",
        },
      ],
    },
    {
      id: "temporada",
      title: "Season for everyone",
      body: "Example: from 11-01 to 02-28, every 21 days. In winter the grass grows less, so every regular cut is spaced out without rewriting each file. A client can keep their own pace. Yards you already moved by hand do not jump back. Months ahead decides how far the schedule is built.",
    },
    {
      id: "propina",
      title: "Tip",
      body: "If someone gives more than they owe, record it as a tip when you mark Done or take a payment. A tip does not change the debt and does not go into Collected. Figures adds it up for the month and the year.",
      points: [
        { id: "propina-anio", body: "Tips this year: extra money for the whole year. It does not change the debt and does not go into Collected." },
        { id: "propina-mes", body: "Tips this month: this month's tips, apart from Collected." },
      ],
    },
    {
      id: "precio",
      title: "Price after done",
      body: "Example: the cut said $40 and it ended at $55. In the client history, tap the price, type 55, and save. The account goes up $15. If the price drops and the balance would go below zero, the extra becomes an advance.",
    },
    {
      id: "ritmo",
      title: "Days in the year",
      body: "The small bar compares days with work hours and rest days. The check Leave out the day that is almost never worked drops that day, which is usually Sunday. A partial day still counts its exact hours. The year, on the same line as the title, lets you compare this year with earlier ones. Why was it not worked? lists the reasons and how many times each one came up. The twelve blocks are the months: the number on top is the month and the smaller one below is how many business days were not worked. Tap a month to read the sentence.",
    },
    {
      id: "sonidos",
      title: "Sounds",
      body: "When All finishes, a short ding plays. Each Done is quieter. In Settings, Sounds, you can turn them off or lower the volume. There is no floating button on the screen.",
    },
    {
      id: "busca",
      title: "Search settings",
      body: "The magnifying glass sits on the Settings line. If you type Manual, only the manual stays. If you type hor or hurs, only Work hours stays. Everything else hides, like phone settings. Each block folds, and the pin keeps it open.",
    },
    {
      id: "una-vez",
      title: "One-time yard",
      body: "Under What needs doing? frequent options appear, such as a cut or a cleanup. Tap one to fill the text, or edit them by hand and type another.",
    },
  ],
};

type Ctx = {
  locale: LocaleName;
  setLocale: (locale: LocaleName) => void;
  t: (key: MsgKey) => string;
};

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleName>(() => readStoredLocale());
  useEffect(() => {
    applyLocale(locale);
  }, [locale]);
  useEffect(() => {
    const sync = () => {
      const next = readStoredLocale();
      setLocaleState((current) => (current === next ? current : next));
    };
    window.addEventListener("ols-look", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ols-look", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const value = useMemo<Ctx>(
    () => ({
      locale,
      setLocale: (next) => {
        setLocaleState(next);
        applyLocale(next);
      },
      t: (key) => (locale === "en" ? en[key] : es[key]),
    }),
    [locale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "es" as LocaleName,
      setLocale: () => undefined,
      t: (key: MsgKey) => es[key],
    };
  }
  return ctx;
}

export function useTx() {
  const { locale } = useI18n();
  return (esText: string, enText: string) => (locale === "en" ? enText : esText);
}

const REASON_EN: Record<string, string> = {
  Lluvia: "Rain",
  "Cita médica": "Doctor appointment",
  "Visita al médico": "Doctor visit",
  "Cita dental": "Dental appointment",
  Dentista: "Dentist",
  Negocios: "Business",
  Otro: "Other",
};

export function reasonLabel(locale: LocaleName, reason: string) {
  if (locale !== "en") return reason;
  return REASON_EN[reason] ?? reason;
}

const EMPHASIS = [
  "Días libres de esta semana",
  "Days off this week",
  "Hecho y cobrado",
  "Hecho y pendiente",
  "Hecho y abonado",
  "Done and paid",
  "Done and unpaid",
  "Done with a partial payment",
  "Trabajo ya hecho",
  "Perdonado este mes",
  "Work already done",
  "Forgiven this month",
  "Partial paid",
  "Por cobrar",
  "To collect",
  "Alto riesgo",
  "High risk",
  "En espera",
  "Waiting",
  "Parar por lluvia",
  "Stop for rain",
  "Días parados",
  "Stopped days",
  "Inventario de clientes",
  "Client inventory",
  "Días del año",
  "Days in the year",
  "Cobrado",
  "Collected",
  "Perdonar",
  "Forgive",
  "Calendario",
  "Calendar",
  "Clientes",
  "Clients",
  "Activos",
  "Ajustes",
  "Settings",
  "Agenda",
  "Schedule",
  "Cifras",
  "Figures",
  "Cobros",
  "Payments",
  "Notas",
  "Abonado",
  "Tema",
  "Theme",
  "Pantalla",
  "Automático",
  "Hecho",
  "Hoy",
  "Today",
  "Done",
  "Bloc de notas",
  "Notepad",
  "Bloc",
  "Pad",
  "Abrir bloc",
  "Open pad",
  "Malla",
  "Mesh",
  "Fichero",
  "Pausa",
  "Pause",
  "Continuar",
  "Play",
  "Filtros",
  "Mantener sesión abierta",
  "Keep me signed in",
  "¿Por qué no se trabajó este día?",
  "Why was this day not worked?",
];

const EMPHASIS_SORTED = [...EMPHASIS].sort((a, b) => b.length - a.length);

export function emphasisTerms(): readonly string[] {
  return EMPHASIS_SORTED;
}

export function isNameTerm(part: string): boolean {
  return (EMPHASIS as readonly string[]).includes(part);
}

export function emphasize(text: string): ReactNode {
  const escaped = EMPHASIS_SORTED.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);
  return parts.map((part, i) =>
    nameDest(part) ? (
      <NameLink key={i} term={part} />
    ) : EMPHASIS.includes(part) ? (
      <span key={i} className="name-ref">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function emphasizeTree(node: ReactNode): ReactNode {
  if (node == null || typeof node === "boolean" || typeof node === "number") return node;
  if (typeof node === "string") return emphasize(node);
  if (Array.isArray(node)) {
    return node.map((child, i) => <Fragment key={i}>{emphasizeTree(child)}</Fragment>);
  }
  if (isValidElement<{ children?: ReactNode }>(node)) {
    const child = node.props.children;
    if (child == null) return node;
    return cloneElement(node, undefined, emphasizeTree(child));
  }
  return node;
}

