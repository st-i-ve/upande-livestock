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


export type Herd = {
  n: string;
  /** Frappe `Herds.herd_name` — display label. Equal to `n` when naming
   *  rule is "By fieldname" (herd_name), but kept separate for safety.
   *  Optional because mock fixture data doesn't carry it. */
  herdName?: string;
  cat: string;
  cnt: number;
  cc: string;
  bom: string;
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

export type Alert = {
  sev: "default" | "danger";
  ic: string;
  t: string;
  s: string;
};
