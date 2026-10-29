import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { BreedingCards } from "@/components/BreedingCards";

const flat = (n: any): string =>
  typeof n === "string" ? n : Array.isArray(n) ? n.map(flat).join("") : n?.children ? flat(n.children) : "";

describe("BreedingCards", () => {
  const cards = [
    { herd: "Bulling Heifers", females: 50, bulls: 2, bullNames: ["Kito", "Simba"] },
    { herd: "Bull Reserve", females: 0, bulls: 1, bullNames: ["Tembo"] },
  ];
  it("highlights each breeding herd with its counts and the bulls named", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<BreedingCards cards={cards} onOpen={() => {}} />); });
    const text = flat(r.toJSON());
    expect(text).toContain("Bulling Heifers");
    expect(text).toContain("50 females · 2 bulls");
    expect(text).toContain("Bulls: Kito, Simba");
    expect(text).toContain("0 females · 1 bull");
    expect(text).toContain("Bull: Tembo");
  });
  it("opens the herd when a card is pressed", () => {
    const onOpen = jest.fn();
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<BreedingCards cards={cards} onOpen={onOpen} />); });
    act(() => { r.root.findByProps({ accessibilityLabel: "Breeding herd Bull Reserve" }).props.onPress(); });
    expect(onOpen).toHaveBeenCalledWith("Bull Reserve");
  });
  it("renders nothing without breeding herds", () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => { r = TestRenderer.create(<BreedingCards cards={[]} onOpen={() => {}} />); });
    expect(r.toJSON()).toBeNull();
  });
});
