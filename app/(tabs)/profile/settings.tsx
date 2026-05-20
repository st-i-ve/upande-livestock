import React from "react";

import { KV } from "@/components/KV";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";

export default function Settings() {
  return (
    <Screen title="Livestock settings" subtitle="Configuration" back>
      <SectionTitle>Default herds</SectionTitle>
      <KV k="Calf herd" v="0-2" />
      <KV k="Bull herd" v="BULLS" />
      <KV k="Dry herd" v="STEAMERS" />
      <SectionTitle>Calf feeding plan</SectionTitle>
      <KV k="Day 1 colostrum" v="10% of birth wt" />
      <KV k="Days 2-5 transitional" v="5% body wt / day" />
      <KV k="Day 6+ whole milk" v="10% body wt / day" />
      <KV k="Weaning" v="Day 60 → 90" />
      <SectionTitle>Reproduction</SectionTitle>
      <KV k="Min service age" v="15 months" />
      <KV k="Min calving age" v="24 months" />
      <SectionTitle>Accounting</SectionTitle>
      <KV k="Milk sales" v="404001" />
      <KV k="Vet expense" v="50101906" />
      <KV k="Feed expense" v="50101905" />
      <KV k="Milk price" v="60 KES/kg" />
    </Screen>
  );
}
