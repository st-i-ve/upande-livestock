import fs from "fs";
import path from "path";

/**
 * The app draws its own pickers and alerts (src/ui/datetimepicker.tsx,
 * components/Picker.tsx, src/ui/alert.ts). Android's own date/time dialogs,
 * dropdowns and toasts must not come back through a new screen: import the
 * app's versions instead.
 */
const ROOT = path.resolve(__dirname, "..");
const DIRS = ["app", "components", "src", "services", "constants"];

const FORBIDDEN: { re: RegExp; use: string }[] = [
  { re: /(from\s+|require\(\s*|import\(\s*)["']@react-native-community\/datetimepicker["']/, use: '"@/src/ui/datetimepicker" (same API)' },
  { re: /(from\s+|require\(\s*|import\(\s*)["']@react-native-picker\/picker["']/, use: '"@/components/Picker"' },
  { re: /\b(ToastAndroid|DatePickerAndroid|TimePickerAndroid)\b/, use: "Alert.alert (the app's alert) or a Banner" },
];

function files(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : files(p);
    return /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}

it("no screen opens Android's own picker, dropdown or toast", () => {
  const hits: string[] = [];
  for (const f of DIRS.flatMap((d) => files(path.join(ROOT, d)))) {
    // Comments may name the native module (the shim says whose API it copies).
    const code = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const { re, use } of FORBIDDEN) {
      if (re.test(code)) hits.push(`${path.relative(ROOT, f)}: ${re.source} — use ${use}`);
    }
  }
  expect(hits).toEqual([]);
});
