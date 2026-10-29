import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "..");
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?|json)$/.test(e.name) ? [p] : [];
  });

describe("milking is removed, not hidden", () => {
  const removed = [
    "app/(tabs)/quality.tsx",
    "app/(tabs)/record/events/milk.tsx",
    "app/(tabs)/record/events/dryoff.tsx",
    "app/(tabs)/animals/act/milk.tsx",
    "app/(tabs)/animals/act/dryoff.tsx",
    "components/QualityOnlyGate.tsx",
    "src/frappe/milkRecording.ts",
    "src/frappe/quality.ts",
    "src/offline",
    "src/hooks/useQueueStatus.ts",
  ];
  it.each(removed)("%s is gone", (f) => {
    expect(fs.existsSync(path.join(root, f))).toBe(false);
  });

  it("no milk / lactation / dry-off / quality word left in app, src, components, services", () => {
    const hits: string[] = [];
    for (const d of ["app", "src", "components", "services", "types", "constants"]) {
      for (const f of walk(path.join(root, d))) {
        // the JPEG quality option of the photo picker is not the Quality tab
        const text = fs.readFileSync(f, "utf8").replace(/quality: 0\.\d+/g, "");
        const m = text.match(/milk|lactat|dry.?off|quality/i);
        if (m) hits.push(`${path.relative(root, f)}: ${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
