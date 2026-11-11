import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { font } from "@/constants/theme";
import { AnimalImage } from "@/components/AnimalImage";
import { Banner } from "@/components/Banner";
import { Loader } from "@/components/Loader";
import { SectionTitle } from "@/components/SectionTitle";
import { isMale, type BullRecord, type Family, type Kin } from "@/src/family";
import { useColors } from "@/src/hooks/useColors";

const open = (id: string | null) => {
  if (id) router.push(`/(tabs)/animals/${encodeURIComponent(id)}` as never);
};

/**
 * Her family as a small tree: dam and sire on top, her in the middle, her
 * calves underneath with a sons/daughters count. Every animal on record opens
 * its own page; a calf that has left the farm is greyed with its status.
 * Photo-less animals wear their silhouette (src/silhouettes.ts).
 */
export function FamilyTree({
  family,
  loading,
  me,
}: {
  family: Family | null | undefined;
  loading?: boolean;
  me: { id: string; name: string; sex: string; dob?: string | null; stage?: string | null; image?: string | null; thumb?: string | null };
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const male = isMale(me.sex);

  if (loading && !family) {
    return (
      <>
        <SectionTitle>Family</SectionTitle>
        <Loader />
      </>
    );
  }
  if (!family) return null;
  const { parents, offspring, sons, daughters } = family;
  const kidsLabel = offspring.length
    ? `${sons} ${sons === 1 ? "son" : "sons"} · ${daughters} ${daughters === 1 ? "daughter" : "daughters"}`
    : male
      ? "No calves recorded to him"
      : "No calves recorded";

  return (
    <>
      <SectionTitle>Family</SectionTitle>
      <View style={s.card} testID="family-tree">
        <View style={s.parents}>
          <Parent role="Dam" kin={parents.dam} />
          <Parent role="Sire" kin={parents.sire} />
        </View>
        <View style={s.joinRow}>
          <View style={s.joinLeft} />
          <View style={s.joinRight} />
        </View>
        <View style={s.stem} />
        <View style={s.meNode}>
          <AnimalImage
            image={me.image}
            thumb={me.thumb}
            animal={{ id: me.id, sex: me.sex, dob: me.dob, stage: me.stage }}
            style={s.meAvatar}
          />
          <Text style={s.meName} numberOfLines={1}>{me.name}</Text>
        </View>
        {offspring.length ? <View style={s.stem} /> : null}
        <View style={s.kidsHead}>
          <Text style={s.kidsTitle}>Offspring{offspring.length ? ` (${offspring.length})` : ""}</Text>
          <Text style={s.kidsCount}>{kidsLabel}</Text>
        </View>
        {offspring.length ? (
          <View style={s.kids}>
            {offspring.map((k, i) => (
              <Child key={k.id ?? `${k.name}-${i}`} kin={k} last={i === offspring.length - 1} />
            ))}
          </View>
        ) : null}
        {family.local ? (
          <Text style={s.note}>Offline: from the animals on this phone; sold or dead calves are not shown.</Text>
        ) : null}
      </View>
    </>
  );
}

function Parent({ role, kin }: { role: "Dam" | "Sire"; kin: Kin | null }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const can = !!kin?.id && kin.onRecord !== false;
  return (
    <Pressable
      accessibilityRole={can ? "button" : undefined}
      accessibilityLabel={kin ? `${role} ${kin.name}` : `${role} not recorded`}
      disabled={!can}
      onPress={() => open(kin?.id ?? null)}
      style={[s.parent, !kin && s.parentEmpty, kin && !kin.active && kin.onRecord !== false && s.gone]}
    >
      {kin ? (
        <AnimalImage
          image={kin.photo}
          thumb={kin.thumb}
          animal={{ id: kin.id ?? kin.name, sex: kin.sex ?? (role === "Dam" ? "Female" : "Male"), dob: kin.dob }}
          style={s.avatar}
        />
      ) : (
        <View style={[s.avatar, s.avatarEmpty]}>
          <MaterialCommunityIcons name="help" size={18} color={c.textSubtle} />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.role}>{role}</Text>
        <Text style={s.name} numberOfLines={1}>{kin?.name ?? "Not recorded"}</Text>
        {kin ? (
          <Text style={s.meta} numberOfLines={1}>
            {kin.onRecord === false ? "not on the farm's record" : [kin.tag && kin.tag !== kin.name ? kin.tag : null, !kin.active ? kin.status : null].filter(Boolean).join(" · ") || kin.id}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function Child({ kin, last }: { kin: Kin; last: boolean }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const male = isMale(kin.sex);
  return (
    <View style={s.childRow}>
      <View style={s.rail}>
        <View style={[s.railLine, last && { bottom: "50%" }]} />
        <View style={s.railTick} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${male ? "Son" : "Daughter"} ${kin.name}`}
        disabled={!kin.id}
        onPress={() => open(kin.id)}
        style={[s.child, !kin.active && s.gone]}
      >
        <AnimalImage
          image={kin.photo}
          thumb={kin.thumb}
          animal={{ id: kin.id ?? kin.name, sex: kin.sex, dob: kin.dob }}
          style={s.childAvatar}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.childLine}>
            <Text style={s.name} numberOfLines={1}>{kin.name}</Text>
            <MaterialCommunityIcons
              name={male ? "gender-male" : "gender-female"}
              size={14}
              color={c.textMuted}
              accessibilityLabel={male ? "male" : "female"}
            />
          </View>
          <Text style={s.meta} numberOfLines={1}>
            {[kin.tag && kin.tag !== kin.name ? kin.tag : null, kin.dob ? `born ${kin.dob}` : "birth date not recorded"]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
        {!kin.active ? (
          <View style={s.status}>
            <Text style={s.statusText}>{kin.status || "Gone"}</Text>
          </View>
        ) : (
          <MaterialCommunityIcons name="chevron-right" size={18} color={c.textSubtle} />
        )}
      </Pressable>
    </View>
  );
}

/** A breeding male's record as a sire: cows bred, services, last service, conception rate. */
export function SireRecord({ bred, offspring }: { bred: BullRecord; offspring: number }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const stats: [string, string][] = [
    ["Cows bred", String(bred.cows)],
    ["Services", String(bred.services)],
    ["Last service", bred.lastService ?? "—"],
    ["Conception", bred.conceptionRate == null ? "—" : `${bred.conceptionRate}%`],
  ];
  return (
    <View style={s.sire} testID="sire-record">
      <Text style={s.role}>As a sire</Text>
      <View style={s.sireStats}>
        {stats.map(([k, v]) => (
          <View key={k} style={s.sireStat}>
            <Text style={s.sireValue} numberOfLines={1}>{v}</Text>
            <Text style={s.meta}>{k}</Text>
          </View>
        ))}
      </View>
      {!bred.services ? (
        <Banner tone="info">No service names him as the sire yet{offspring ? `; ${offspring} calves do` : ""}.</Banner>
      ) : null}
    </View>
  );
}

const AV = 40;

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: { borderWidth: 1, borderColor: c.borderSubtle, borderRadius: 14, padding: 12, marginBottom: 12 },
    parents: { flexDirection: "row", gap: 10 },
    parent: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: 8, padding: 8,
      borderRadius: 12, backgroundColor: c.bgMuted,
    },
    parentEmpty: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: c.border },
    avatar: { width: AV, height: AV, borderRadius: AV / 2 },
    avatarEmpty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border },
    role: { fontSize: 9, ...font("600"), letterSpacing: 1, textTransform: "uppercase", color: c.textSubtle },
    name: { fontSize: 14, ...font("600"), color: c.text, flexShrink: 1 },
    meta: { fontSize: 11, color: c.textMuted },
    joinRow: { flexDirection: "row", height: 10, marginHorizontal: "25%" },
    joinLeft: { flex: 1, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: c.border, borderBottomLeftRadius: 6 },
    joinRight: { flex: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.border, borderBottomRightRadius: 6 },
    stem: { alignSelf: "center", width: 1, height: 10, backgroundColor: c.border },
    meNode: {
      alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "80%",
      paddingVertical: 6, paddingLeft: 6, paddingRight: 14, borderRadius: 999,
      borderWidth: 1.5, borderColor: c.selected, backgroundColor: c.selectedBg,
    },
    meAvatar: { width: 32, height: 32, borderRadius: 16 },
    meName: { fontSize: 14, ...font("700"), color: c.text, flexShrink: 1 },
    kidsHead: {
      flexDirection: "row", justifyContent: "space-between", alignItems: "baseline",
      marginTop: 10, paddingBottom: 6, borderBottomWidth: 1, borderColor: c.borderSubtle,
    },
    kidsTitle: { fontSize: 13, ...font("600"), color: c.text },
    kidsCount: { fontSize: 12, color: c.textMuted },
    kids: { paddingTop: 2 },
    childRow: { flexDirection: "row", alignItems: "stretch" },
    rail: { width: 16 },
    railLine: { position: "absolute", left: 6, top: 0, bottom: 0, width: 1, backgroundColor: c.border },
    railTick: { position: "absolute", left: 6, top: "50%", width: 9, height: 1, backgroundColor: c.border },
    child: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7 },
    childAvatar: { width: 36, height: 36, borderRadius: 18 },
    childLine: { flexDirection: "row", alignItems: "center", gap: 4 },
    gone: { opacity: 0.45 },
    status: { borderWidth: 1, borderColor: c.border, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
    statusText: { fontSize: 10, ...font("600"), color: c.textMuted, textTransform: "uppercase" },
    note: { fontSize: 11, color: c.textSubtle, marginTop: 8 },
    sire: { padding: 14, marginBottom: 12, borderRadius: 14, borderWidth: 1, borderColor: c.border, gap: 8 },
    sireStats: { flexDirection: "row", flexWrap: "wrap" },
    sireStat: { width: "50%", paddingVertical: 4 },
    sireValue: { fontSize: 18, ...font("700"), color: c.text },
  });
