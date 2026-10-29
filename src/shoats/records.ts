/** The Shoats Record menu: Weigh sample first, then the rest. Hrefs are routes under app/(shoats)/record. */
export type ShoatRecordItem = { icon: string; label: string; blurb: string; href: string };

export const SHOAT_RECORD_ITEMS: ShoatRecordItem[] = [
  { icon: "scale", label: "Weigh sample", blurb: "Weigh a few, record how many and the average", href: "/(shoats)/record/weigh" },
  { icon: "counter", label: "Count & movements", blurb: "Head count, death, purchase, sale, slaughter, transfer", href: "/(shoats)/record/count" },
  { icon: "heart", label: "Breeding", blurb: "Mating, lambing or kidding, weaning", href: "/(shoats)/record/breeding" },
  { icon: "medical-bag", label: "Health", blurb: "Treatment, dipping, deworming, vaccination", href: "/(shoats)/record/health" },
  { icon: "grain", label: "Feeding", blurb: "Feed the herd its ration", href: "/(shoats)/record/feeding" },
];
