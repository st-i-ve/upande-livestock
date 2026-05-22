export type Animal = {
  id: string;
  name: string;
  sex: "F" | "M";
  dob: string;
  herd: string;
  repro: string;
  dim: number | null;
  parity: number;
  lastWt: number;
  milkSafe: string | null;
  inTreatment: 0 | 1;
  pregnant: 0 | 1;
};

export type RationItem = { name: string; pct: number };

export type Herd = {
  n: string;
  cat: string;
  cnt: number;
  cc: string;
  bom: string;
  ration: RationItem[];
  kgPerHeadPerDay: number;
  isMilking?: boolean;
  isDry?: boolean;
};

export type DrawerItem = {
  id: string;
  ic: string;
  l: string;
  href: string;
  b?: number;
};

export type DrawerGroup = { grp: string; its: DrawerItem[] };

export type Tone = "info" | "success" | "warning" | "danger" | "muted";

export type DailyMilkRow = {
  herd: string;
  cnt: number;
  am: number | null;
  pm: number | null;
  expected: number;
};

export type Alert = {
  sev: "default" | "danger";
  ic: string;
  t: string;
  s: string;
};
