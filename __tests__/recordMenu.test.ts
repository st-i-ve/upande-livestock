import fs from "fs";
import path from "path";

import { RECORD_SECTIONS, WEIGHT_HREF } from "@/src/beef/records";

const root = path.resolve(__dirname, "..");
const routeFile = (href: string) => {
  const rel = href.replace(/^\//, "").replace(/\/$/, "");
  return [`app/${rel}.tsx`, `app/${rel}/index.tsx`].map((f) => path.join(root, f));
};

describe("Record menu", () => {
  it("opens with Weight: first section, first item", () => {
    expect(RECORD_SECTIONS[0].title).toBe("Weight");
    expect(RECORD_SECTIONS[0].items[0].href).toBe(WEIGHT_HREF);
    expect(RECORD_SECTIONS[0].items[0].label).toMatch(/weight/i);
  });

  it("orders the rest: Breeding, Movement, Health, Husbandry, Stores", () => {
    expect(RECORD_SECTIONS.map((s) => s.title)).toEqual(["Weight", "Breeding", "Movement", "Health", "Husbandry", "Stores"]);
  });

  it("offers natural service with AI as an option, calving, PD and calf separation", () => {
    const labels = RECORD_SECTIONS.flatMap((s) => s.items.map((i) => i.label.toLowerCase()));
    expect(labels).toEqual(expect.arrayContaining([expect.stringMatching(/service/), "pregnancy diagnosis", "calving", "calf separation", "movement"]));
  });

  it("every entry points at a screen that exists (no stale link)", () => {
    const hrefs = RECORD_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    const generic = ["vaccination", "deworming", "dehorning", "hoof", "heat"]; // served by events/[type]
    for (const href of hrefs) {
      const leaf = href.split("/").pop()!;
      const ok = routeFile(href).some((f) => fs.existsSync(f)) || (href.includes("/record/events/") && generic.includes(leaf));
      expect({ href, ok }).toEqual({ href, ok: true });
    }
  });

  it("has no milking, drying-off or quality entry", () => {
    const text = JSON.stringify(RECORD_SECTIONS).toLowerCase();
    expect(text).not.toMatch(/milk|dry.?off|drying|quality|lactat/);
  });
});
