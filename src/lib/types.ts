export type ClientKind = "regular" | "one_time";
export type JobKind = "cut" | "extra" | "one_time";
export type JobStatus = "pending" | "done" | "cancelled";
export type ComputedStatus = "pending" | "done" | "late" | "cancelled";
export type PaymentKind = "paid" | "waived" | "prepaid" | "opening";
export type CutsPerMonth = 1 | 2 | 3 | 4 | 5;
export type PayTier = "al_dia" | "espera" | "serio";
export type ThemeName = "light" | "amoled";
export type PaletteName = "jardin" | "costa" | "barro" | "pino" | "cielo";
export type LocaleName = "es" | "en";

export type ClientRow = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  richNotes: string;
  kind: ClientKind;
  pricePerCut: number;
  cutsPerMonth: CutsPerMonth;
  weekday: number;
  weekday2: number | null;
  frequencyDays: number | null;
  arrivalTime: string | null;
  startDate: string | null;
  paySameDay: boolean;
  payDueDay: number | null;
  sortOrder: number;
  balance: number;
  credit: number;
  isActive: boolean;
  createdAt: string;
  nextCutDate: string | null;
  overdueDate: string | null;
  lastCutDate: string | null;
  collectedTotal: number;
  cutsThisMonth: number;
  tripleCut: boolean;
  cue: string | null;
  pinned: boolean;
  blacklisted: boolean;
  servicePaused: boolean;
  highRisk: boolean;
  hasExtra: boolean;
  deactivatedAt: string | null;
  standingExtras: string[];
  seasonStart: string | null;
  seasonEnd: string | null;
  seasonEvery: number | null;
  daysSincePay: number | null;
  payTier: PayTier;
  reliability: number;
};

export type JobRow = {
  id: number;
  clientId: number;
  clientName: string;
  clientPhone: string | null;
  clientAddress: string | null;
  paySameDay: boolean;
  credit: number;
  scheduledDate: string;
  arrivalTime: string | null;
  sortOrder: number;
  status: JobStatus;
  computedStatus: ComputedStatus;
  kind: JobKind;
  title: string | null;
  amount: number;
  notes: string | null;
  completedAt: string | null;
  pinned: boolean;
  pinLocked?: boolean;
  postponeReason: string | null;
  originDate: string | null;
  clientCue: string | null;
  standingExtras: string[];
  hasPhoto?: boolean;
};

export type PaymentRow = {
  id: number;
  clientId: number;
  clientName?: string;
  amount: number;
  kind: PaymentKind;
  note: string | null;
  paidAt: string;
  method: string | null;
  tip?: number;
};

export type DayEffort = {
  date: string;
  weekday: number;
  done: number;
  pending: number;
};

export type DashboardData = {
  today: JobRow[];
  todayDone: JobRow[];
  overdue: JobRow[];
  upcoming: JobRow[];
  weekEffort: DayEffort[];
  weekGoals: { date: string; goal: number }[];
  stats: {
    activeClients: number;
    regularClients: number;
    oneTimeClients: number;
    pendingToday: number;
    doneToday: number;
    overdueCount: number;
    outstanding: number;
    collectedMonth: number;
    completedMonth: number;
    completedWeek: number;
    weekPendingCount: number;
    weekPendingAmount: number;
    weekDoneCount: number;
    archivedClients: number;
  };
};

export type ClientSort =
  | "name"
  | "name_desc"
  | "newest"
  | "oldest"
  | "price_desc"
  | "price_asc"
  | "balance_desc"
  | "balance_asc"
  | "next_cut"
  | "overdue";

export type ClientFilter =
  | "active"
  | "regular"
  | "one_time"
  | "inactive"
  | "owing"
  | "triple"
  | "blacklist"
  | "risk";

export type JobListFilter = "pending" | "late" | "done" | "cancelled" | "all";
export type JobRange = "week" | "month" | "ahead" | "all" | "history";

export type AppSettings = {
  businessName: string;
  theme: ThemeName;
  remindersEnabled: boolean;
  askYesterday: boolean;
  reminderMinutes: number;
  dailyGoal: number | null;
  lastBackupAt: string | null;
  clientCount: number;
  jobCount: number;
  weekGoals: Record<string, number>;
  abonoPresets: number[];
  vacationStart: string | null;
  vacationEnd: string | null;
  vacationShift: number;
  excludedWeekdays: number[];
  taskPresets: string[];
  arrivalPresets: string[];
  pricePresets: number[];
  debtPresets: number[];
  visitPresets: string[];
  cuePresets: string[];
  riskDays: number;
  riskAmount: number;
  riskCuts: number;
  waitDays: number;
  messagePresets: string[];
  horizonMonths: number;
  seasonStart: string | null;
  seasonEnd: string | null;
  seasonEvery: number | null;
  locale: LocaleName;
  palette: PaletteName;
  workStart: string;
  workEnd: string;
};

export const DEFAULT_TASK_PRESETS = [
  "Cortar césped",
  "Cortar árbol",
  "Podar",
  "Crear jardín",
  "Poner grama",
  "Sembrar flores",
  "Fumigar",
  "Limpieza pesada",
  "Limpieza regular",
  "Limpieza leve",
];

export const POSTPONE_REASONS = ["Lluvia", "Cita médica", "Cita dental", "Negocios", "Otro"];

export const STOP_REASONS = ["Lluvia", "Visita al médico", "Dentista", "Otro"];

export const PAY_METHODS = [
  { id: "efectivo", label: "Efectivo" },
  { id: "zelle", label: "Zelle" },
  { id: "cheque", label: "Cheque" },
  { id: "otro", label: "Otro" },
] as const;

export const DEFAULT_MESSAGE_PRESETS = [
  "Hola. Voy en camino.",
  "Hola. Estoy en su casa, ábrame la puerta.",
  "Estaré en 10 minutos.",
];

export const DEFAULT_ARRIVAL_PRESETS = ["08:00", "09:00", "10:00", "14:00", "16:00"];
export const DEFAULT_PRICE_PRESETS = [30, 35, 40, 45, 50, 60];
export const DEFAULT_DEBT_PRESETS = [40, 60, 80, 100, 150, 200];
export const DEFAULT_VISIT_PRESETS = ["Orilla", "Soplado", "Perro suelto", "Recoger hojas"];
export const DEFAULT_CUE_PRESETS = ["Casa azul", "Esquina", "El de la cerca", "Vecino de @"];

export type BackupSummary = {
  id: number;
  createdAt: string;
  clientCount: number;
  jobCount: number;
};

export type MoneyPoint = {
  label: string;
  key: string;
  collected: number;
  completed: number;
  cuts: number;
  extraCuts: number;
  extraAmount: number;
  onceCuts: number;
  onceAmount: number;
};

export type ClientFlowPoint = {
  label: string;
  key: string;
  altas: number;
  bajas: number;
};

export type FinanceStats = {
  weekSeries: MoneyPoint[];
  monthSeries: MoneyPoint[];
  yearSeries: MoneyPoint[];
  clientFlow: ClientFlowPoint[];
  weekEffort: DayEffort[];
  thisWeekCuts: number;
  lastWeekCuts: number;
  thisWeekCollected: number;
  lastWeekCollected: number;
  latePayers: number;
  avgWeekCuts: number;
  avgWeekCollected: number;
  medianWeekCuts: number;
  avgTicket: number;
  owingPeople: number;
  waitPeople: number;
  seriousPeople: number;
  currentPeople: number;
  postponeReasons: { reason: string; count: number }[];
  tipsYear: number;
  tipsMonth: number;
  lifetimeCollected: number;
  lifetimeCuts: number;
  hoursToday: number;
  hoursWeek: number;
  hoursMonth: number;
  stopReasons: { reason: string; count: number }[];
};

export type PadJob = {
  id: number;
  clientId: number;
  clientName: string;
  date: string;
  title: string;
  status: string;
  amount: number;
};

export type PadPage = {
  id: number;
  title: string;
  body: string;
  sortOrder: number;
  folder: string;
  pinned: boolean;
  tags: string;
  dueDate: string | null;
  dueTime: string | null;
  clientIds: number[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PadDay = {
  date: string;
  weekday: number;
  items: PadJob[];
};

export type PadData = {
  pages: PadPage[];
  weekDays: PadDay[];
  clients: { id: number; name: string; phone: string | null; cue: string | null }[];
};

export type YearRhythm = {
  year: number;
  worked: number;
  rest: number;
  minutes: number;
  todayMinutes: number;
  through: string;
  posts: { reason: string; count: number }[];
  stops: { reason: string; count: number }[];
  offs: { reason: string; count: number }[];
  months: number[];
};

export type PostponedHit = {
  clientName: string;
  date: string;
  title: string;
};

export type PadPhoto = {
  id: number;
  data: string;
  createdAt: string;
};

export type ClientPhoto = {
  id: number;
  caption: string | null;
  data: string;
  createdAt: string;
};

export type ClientChange = {
  id: number;
  summary: string;
  snapshot: string;
  createdAt: string;
};

export const DEFAULT_ABONO_PRESETS = [10, 20, 30, 40, 50, 60];
