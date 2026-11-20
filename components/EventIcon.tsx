import {
  Baby, ArrowRightLeft, Bug, ClipboardPlus, Dna, Droplets, Flame, FlaskConical, Footprints,
  HeartCrack, Moon, Pill, ScanHeart, Scale, Scissors, Sparkles, Stethoscope, Syringe, Trash2,
  Utensils, type LucideIcon,
} from "lucide-react-native";
import React from "react";

import { eventEntry } from "@/src/events/eventCatalog";

/** lucide icon name (as in the desk's event catalog) -> component. Same names as the desk's ICONS. */
const ICONS: Record<string, LucideIcon> = {
  Baby, ArrowRightLeft, Bug, ClipboardPlus, Dna, Droplets, Flame, FlaskConical, Footprints,
  HeartCrack, Moon, Pill, ScanHeart, Scale, Scissors, Sparkles, Stethoscope, Syringe, Trash2,
  Utensils,
};

/** The desk's icon for a Livestock Event Type (or catalog key); an unknown one gets a neutral spark. */
export function EventIcon({ event, size = 20, color }: { event: string; size?: number; color: string }) {
  const Icon = ICONS[eventEntry(event)?.icon ?? ""] ?? Sparkles;
  return <Icon size={size} color={color} strokeWidth={2} />;
}
