import app from "../app.json";
import { DEFAULT_INSTANCE_URL } from "@/src/services/storage";
import { dueLine, optionOf, separationRemarks } from "@/src/beef/separation";

describe("Mutara app identity", () => {
  const e = app.expo as any;
  it("has its own name, slug, scheme and packages (installs beside Kaitet's)", () => {
    expect(e.name).toBe("Upande Livestock Mutara");
    expect(e.slug).toBe("upande-livestock-mutara");
    expect(e.scheme).toBe("upandelivestockmutara");
    expect(e.android.package).toBe("com.upande.livestockmutara");
    expect(e.ios.bundleIdentifier).toBe("com.upande.livestockmutara");
    expect(e.android.package).not.toBe("com.stivewithani.upandelivestock");
  });
  it("runs its own runtime version", () => {
    expect(e.runtimeVersion).toBe("1.1.0-mutarabeeffrappe16");
  });
  it("keeps Kaitet's EAS project out; the id is a placeholder until the user creates one", () => {
    expect(JSON.stringify(e)).not.toContain("0640a515");
    expect(e.extra.eas.projectId).toBe("00000000-0000-0000-0000-000000000000");
  });
  it("login pre-fills the Mutara site", () => {
    expect(DEFAULT_INSTANCE_URL).toBe("https://mutara.132.145.18.63.nip.io");
  });
});

describe("calf separation rows", () => {
  const due = {
    animal: "B012/26", label: "Simba", sex: "Male", herd: "Lactation Group 1", age_days: 230, over_days: 20, weight_kg: 168,
    options: [{ stream: "Feedlot", herd: "Starters" }, { stream: "Breeding", herd: null, herds: ["Bull Reserve"] }],
  };
  it("describes the calf and finds each stream's option", () => {
    expect(dueLine(due)).toBe("230 days old, 20 over · Lactation Group 1 · 168 kg");
    expect(optionOf(due, "Feedlot")?.herd).toBe("Starters");
    expect(optionOf(due, "Breeding")?.herds).toEqual(["Bull Reserve"]);
    expect(optionOf(due, "Heifer")).toBeUndefined();
  });
  it("writes the remark of a non-breeding separation move", () => {
    expect(separationRemarks("Feedlot", "Starters")).toMatch(/Starters/);
  });
});
