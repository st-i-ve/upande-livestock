import { nutritionistOnly, rationEditorUrl } from "@/src/auth/roles";

describe("Livestock Nutritionist", () => {
  it("is nutritionist-only with that role and no farm role", () => {
    expect(nutritionistOnly(["Livestock Nutritionist", "Guest", "All"])).toBe(true);
  });
  it("any farm role, or System Manager, keeps the whole app", () => {
    for (const r of ["Livestock Manager", "Livestock Vet", "Livestock Breeder", "Livestock Attendant", "Livestock Stores", "System Manager", "Administrator"]) {
      expect(nutritionistOnly(["Livestock Nutritionist", r])).toBe(false);
    }
  });
  it("roles not yet known, or no nutritionist role, is not nutritionist-only", () => {
    expect(nutritionistOnly(null)).toBe(false);
    expect(nutritionistOnly([])).toBe(false);
    expect(nutritionistOnly(["Livestock Attendant"])).toBe(false);
  });
  it("points at the web's Ration Editor on the signed-in site", () => {
    expect(rationEditorUrl("https://mutara.fsn.frappe.cloud/")).toBe("https://mutara.fsn.frappe.cloud/livestock_app#/ration-editor");
  });
});
