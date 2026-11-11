import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { font, RADIUS } from "@/constants/theme";
import { BACKDATE_AMBER_DARK, BACKDATE_AMBER_LIGHT } from "@/components/BackdateButton";
import type { BirthCheck } from "@/src/frappe/birthCheck";
import { useColors } from "@/src/hooks/useColors";
import { useScheme } from "@/src/theme/themeStore";

/**
 * What the birth window says about this dam, before the calves are typed in.
 *
 * Allowed: one line naming the pregnancy the birth is recorded against.
 * Not allowed: why (no confirmed pregnancy, no service in the window), the
 * dates a service would have to fall on, and either the steps of the retro
 * path or — while backdating is closed and the user is not a manager — who
 * has to do it. The steps themselves are the screen's fields below this.
 */
export function BirthWindowNotice({ check, damName }: { check: BirthCheck; damName: string }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const amber = useScheme() === "dark" ? BACKDATE_AMBER_DARK : BACKDATE_AMBER_LIGHT;

  if (check.allowed && check.basis) {
    const why =
      check.basis.kind === "diagnosis"
        ? `her confirmed pregnancy (service ${check.basis.service_date})`
        : `her service on ${check.basis.service_date}, which fits the ${check.window.min_days}–${check.window.max_days} day window`;
    return (
      <View style={[s.box, { borderColor: c.borderSubtle }]} accessibilityLabel="Birth window: allowed">
        <Text style={s.text}>{`This birth is recorded against ${why}.`}</Text>
      </View>
    );
  }

  return (
    <View style={[s.box, { borderColor: amber, backgroundColor: `${amber}14` }]} accessibilityLabel="Birth window: service needed">
      <Text style={[s.title, { color: amber }]}>No pregnancy on record for this birth</Text>
      <Text style={s.text}>
        {`${damName} has no confirmed pregnancy diagnosis and no service that fits a birth on ${check.birth_date}. ` +
          `A calf is born ${check.window.min_days}–${check.window.max_days} days after its service, so she was served ` +
          `between ${check.service_from} and ${check.service_to}.`}
      </Text>
      {check.retro_allowed ? (
        <>
          <Text style={[s.text, { marginTop: 6 }]}>Record what happened first, then the birth:</Text>
          <Text style={s.step}>{`1. The service: its date (${check.service_from} to ${check.service_to}) and A.I. straw or bull.`}</Text>
          {check.allow_diagnosis ? (
            <Text style={s.step}>2. The pregnancy diagnosis, if one was done (optional).</Text>
          ) : null}
          <Text style={s.step}>{`${check.allow_diagnosis ? "3" : "2"}. The herd she was in on the service date.`}</Text>
          <Text style={s.step}>{`${check.allow_diagnosis ? "4" : "3"}. The birth, below. All of it is saved together, marked Backdated.`}</Text>
        </>
      ) : (
        <Text style={[s.text, { marginTop: 6, color: c.danger }]}>
          {check.retro_refusal ||
            "A Livestock Manager must record this birth, or turn on Backdating Open in Livestock Settings."}
        </Text>
      )}
    </View>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    box: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 10, marginBottom: 10 },
    title: { fontSize: 13, ...font("600"), marginBottom: 4 },
    text: { fontSize: 12, color: c.text, lineHeight: 17 },
    step: { fontSize: 12, color: c.textMuted, marginTop: 3, lineHeight: 17 },
  });
