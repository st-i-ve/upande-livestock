import React from "react";
import TestRenderer, { act } from "react-test-renderer";

jest.mock("@/src/theme/themeStore", () => ({ useScheme: () => "light" }));

import { BirthWindowNotice } from "@/components/BirthWindowNotice";
import { Timeline } from "@/components/Timeline";
import type { BirthCheck } from "@/src/frappe/birthCheck";

const flat = (n: any): string =>
  typeof n === "string" ? n : Array.isArray(n) ? n.map(flat).join("") : n?.children ? flat(n.children) : "";

const base: BirthCheck = {
  allowed: false, basis: null, message: "", current_herd: "Lactating", birth_date: "2026-11-11",
  window: { min_days: 270, max_days: 295 }, service_from: "2026-01-20", service_to: "2026-02-14",
  retro_allowed: true, retro_refusal: "", is_manager: false, backdating_open: true, allow_diagnosis: true,
};

const render = (el: React.ReactElement) => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(el); });
  return r;
};

describe("BirthWindowNotice", () => {
  it("explains the rule and lists the retro steps", () => {
    const text = flat(render(<BirthWindowNotice check={base} damName="LE151" />).toJSON());
    expect(text).toContain("No pregnancy on record");
    expect(text).toContain("between 2026-01-20 and 2026-02-14");
    expect(text).toContain("2. The pregnancy diagnosis");
    expect(text).toContain("4. The birth");
  });

  it("drops the diagnosis step when Settings does not allow it", () => {
    const text = flat(render(<BirthWindowNotice check={{ ...base, allow_diagnosis: false }} damName="LE151" />).toJSON());
    expect(text).not.toContain("2. The pregnancy diagnosis");
    expect(text).toContain("3. The birth");
  });

  it("says who must do it when this user may not", () => {
    const text = flat(
      render(<BirthWindowNotice check={{ ...base, retro_allowed: false, retro_refusal: "Ask a manager." }} damName="LE151" />).toJSON(),
    );
    expect(text).toContain("Ask a manager.");
    expect(text).not.toContain("1. The service");
  });

  it("names the pregnancy an allowed birth is recorded against", () => {
    const ok = { ...base, allowed: true, basis: { kind: "service" as const, service: "SERVICE-1", service_date: "2026-02-01" } };
    expect(flat(render(<BirthWindowNotice check={ok} damName="LE151" />).toJSON())).toContain("her service on 2026-02-01");
  });
});

describe("Timeline", () => {
  it("badges and tints a backdated record, and leaves a live one plain", () => {
    const r = render(
      <Timeline events={[
        { date: "2026-02-01", title: "Service", isBackdated: true },
        { date: "2026-11-11", title: "Calving" },
      ]} />,
    );
    expect(flat(r.toJSON())).toContain("Backdated");
    const tinted = r.root.findAll((n) => n.props.accessibilityLabel === "Service, backdated");
    expect(tinted.length).toBeGreaterThan(0);
    expect(r.root.findAll((n) => n.props.accessibilityLabel === "Calving, backdated")).toHaveLength(0);
  });
});
