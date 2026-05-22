// NOTE: Most data here has been replaced by live Frappe reads in sub-project #1.
// What remains is fixture data used by screens that have not yet been migrated:
// the record/* event screens, the profile configurations drawer, and the animal
// picker sheet. Sub-project #2 (online writes) will replace these.
import type { Animal, DrawerGroup, Herd } from "@/types";

export const animals: Animal[] = [
  { id: "BELLA-129290", name: "BELLA", sex: "F", dob: "2019-09-28", herd: "Lactating group 1", repro: "Lactating", dim: 127, parity: 3, lastWt: 485, milkSafe: null, inTreatment: 0, pregnant: 0 },
  { id: "MARIA-129440", name: "MARIA", sex: "F", dob: "2024-10-25", herd: "4-12 MONTHS", repro: "Heifer", dim: null, parity: 0, lastWt: 185, milkSafe: null, inTreatment: 0, pregnant: 0 },
  { id: "TESTHF-001/24", name: "TEST IVY", sex: "F", dob: "2024-04-09", herd: "Lactating group 1", repro: "Fresh / Lactating", dim: 24, parity: 1, lastWt: 480, milkSafe: "2026-05-12", inTreatment: 1, pregnant: 0 },
  { id: "TESTBC-001/26", name: "TEST BLOSSOM", sex: "F", dob: "2026-04-15", herd: "0-2", repro: "Calf", dim: null, parity: 0, lastWt: 42, milkSafe: null, inTreatment: 0, pregnant: 0 },
  { id: "PUTIN-129508", name: "PUTIN", sex: "M", dob: "2024-10-20", herd: "BULLS", repro: "Bull", dim: null, parity: 0, lastWt: 520, milkSafe: null, inTreatment: 0, pregnant: 0 },
  { id: "DOLLY-129333", name: "DOLLY", sex: "F", dob: "2022-12-13", herd: "STEAMERS", repro: "Pregnant 8mo", dim: null, parity: 2, lastWt: 520, milkSafe: null, inTreatment: 0, pregnant: 1 },
  { id: "GRACY-129375", name: "GRACY", sex: "F", dob: "2024-04-30", herd: "12 MONTHS-SERVICE", repro: "Heifer / served", dim: null, parity: 0, lastWt: 340, milkSafe: null, inTreatment: 0, pregnant: 0 },
  { id: "AISHA-129264", name: "AISHA", sex: "F", dob: "2021-06-01", herd: "INCALF HEIFERS", repro: "Pregnant 5mo", dim: null, parity: 0, lastWt: 430, milkSafe: null, inTreatment: 0, pregnant: 1 },
  { id: "BROOKE-129297", name: "BROOKE", sex: "F", dob: "2025-03-17", herd: "4-12 MONTHS", repro: "Heifer", dim: null, parity: 0, lastWt: 165, milkSafe: null, inTreatment: 0, pregnant: 0 },
  { id: "DOHA-129331", name: "DOHA", sex: "F", dob: "2019-09-27", herd: "LACTATION GROUP 2", repro: "Lactating", dim: 240, parity: 4, lastWt: 510, milkSafe: null, inTreatment: 0, pregnant: 0 },
];

// Rations are realistic per herd type — high-yield TMR is denser in concentrate,
// bulls get a lean maintenance mix, calves get a milk-based plan.
export const herds: Herd[] = [
  { n: "0-2", cat: "Calves <2 m", cnt: 12, cc: "Calf rearing - WDL", bom: "Calf rearing plan",
    kgPerHeadPerDay: 4,
    ration: [{ name: "Whole milk", pct: 80 }, { name: "Calf starter pellets", pct: 20 }] },
  { n: "2-4", cat: "Calves 2-4 m", cnt: 18, cc: "Calf rearing - WDL", bom: "Weaner ration",
    kgPerHeadPerDay: 5,
    ration: [{ name: "Whole milk", pct: 50 }, { name: "Calf starter pellets", pct: 40 }, { name: "Lucerne hay", pct: 10 }] },
  { n: "4-12 MONTHS", cat: "Heifers 4-12 m", cnt: 78, cc: "Youngstock - WDL", bom: "Growing heifer ration",
    kgPerHeadPerDay: 8,
    ration: [{ name: "Maize silage", pct: 50 }, { name: "Lucerne hay", pct: 25 }, { name: "Dairy concentrate", pct: 20 }, { name: "Mineral premix", pct: 5 }] },
  { n: "12 MONTHS-SERVICE", cat: "Heifers 12+ m", cnt: 42, cc: "Youngstock - WDL", bom: "Bulling heifer ration",
    kgPerHeadPerDay: 9,
    ration: [{ name: "Maize silage", pct: 55 }, { name: "Lucerne hay", pct: 25 }, { name: "Dairy concentrate", pct: 15 }, { name: "Mineral premix", pct: 5 }] },
  { n: "INCALF HEIFERS", cat: "Pregnant heifers", cnt: 34, cc: "Youngstock - WDL", bom: "In-calf heifer ration",
    kgPerHeadPerDay: 11,
    ration: [{ name: "Maize silage", pct: 60 }, { name: "Lucerne hay", pct: 22 }, { name: "Dairy concentrate", pct: 15 }, { name: "Mineral premix", pct: 3 }] },
  { n: "Lactating group 1", cat: "Group 1 milkers", cnt: 46, cc: "Lactating G1 - WDL", bom: "High-yield TMR (35 kg DMI)",
    kgPerHeadPerDay: 35,
    ration: [{ name: "Maize silage", pct: 60 }, { name: "Lucerne hay", pct: 18 }, { name: "Dairy concentrate (high-yield)", pct: 18 }, { name: "Mineral premix", pct: 4 }] },
  { n: "LACTATION GROUP 2", cat: "Group 2 milkers", cnt: 38, cc: "Lactating G2 - WDL", bom: "Mid-yield TMR (28 kg DMI)",
    kgPerHeadPerDay: 28,
    ration: [{ name: "Maize silage", pct: 65 }, { name: "Lucerne hay", pct: 18 }, { name: "Dairy concentrate (mid-yield)", pct: 13 }, { name: "Mineral premix", pct: 4 }] },
  { n: "Super high yielders", cat: "Top producers", cnt: 8, cc: "Lactating G1 - WDL", bom: "Premium TMR (40 kg DMI)",
    kgPerHeadPerDay: 40,
    ration: [{ name: "Maize silage", pct: 50 }, { name: "Lucerne hay", pct: 22 }, { name: "Dairy concentrate (high-yield)", pct: 24 }, { name: "Mineral premix", pct: 4 }] },
  { n: "STEAMERS", cat: "Pre-calving", cnt: 18, cc: "Dry cow - WDL", bom: "Steaming-up ration",
    kgPerHeadPerDay: 15,
    ration: [{ name: "Maize silage", pct: 60 }, { name: "Lucerne hay", pct: 25 }, { name: "Dairy concentrate (mid-yield)", pct: 12 }, { name: "Mineral premix", pct: 3 }] },
  { n: "BULLS", cat: "Bulls", cnt: 14, cc: "Bulls - WDL", bom: "Bull maintenance ration",
    kgPerHeadPerDay: 12,
    ration: [{ name: "Maize silage", pct: 70 }, { name: "Lucerne hay", pct: 20 }, { name: "Dairy concentrate (mid-yield)", pct: 8 }, { name: "Mineral premix", pct: 2 }] },
];

export const semenItems = [
  "Semen Delta Stormer-F (4040030377)",
  "Semen Delta Keen-F (4040030372)",
  "Semen Delta Smash-F (SDS-H-201)",
];

// Stock items used by the calf-feed and animal-feed pickers.
export const feedStockItems = [
  "Maize silage",
  "Lucerne hay",
  "Dairy concentrate (high-yield)",
  "Dairy concentrate (mid-yield)",
  "Mineral premix",
  "Calf starter pellets",
  "WestWood Dairy Milk (kg)",
  "Colostrum (kg)",
  "Milk Replacer (Hi-Pro)",
  "Transitional milk (kg)",
];

export const warehouses = ["Stores - WDL", "Finished Goods - WDL", "Silage Pit 1", "Silage Pit 2"];

// Drawer mirrors the bottom-tab structure; events live under the Record tab now.
export const drawerStruct: DrawerGroup[] = [
  { grp: "Archives", its: [
    { id: "sales", ic: "cash", l: "Sales", href: "/(tabs)/profile/sales" },
    { id: "culls", ic: "delete-outline", l: "Culls / deaths", href: "/(tabs)/profile/culls" },
  ]},
  { grp: "Reports", its: [
    { id: "r_milk", ic: "chart-line", l: "Milk yield", href: "/(tabs)/profile/reports/milk" },
    { id: "r_repro", ic: "heart-multiple", l: "Reproduction", href: "/(tabs)/profile/reports/repro" },
    { id: "r_health", ic: "file-document", l: "Health & costs", href: "/(tabs)/profile/reports/health" },
    { id: "r_growth", ic: "chart-bar", l: "Calf growth", href: "/(tabs)/profile/reports/growth" },
  ]},
  { grp: "Inventory", its: [
    { id: "inv_col", ic: "water", l: "Colostrum bank", href: "/(tabs)/profile/inventory/colostrum" },
    { id: "inv_drug", ic: "pill", l: "Drugs", href: "/(tabs)/profile/inventory/drugs" },
    { id: "inv_semen", ic: "test-tube", l: "Semen straws", href: "/(tabs)/profile/inventory/semen" },
    { id: "inv_feed", ic: "grain", l: "Feed", href: "/(tabs)/profile/inventory/feed" },
  ]},
];

