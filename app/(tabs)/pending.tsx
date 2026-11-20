import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { ConfirmModal } from "@/components/ConfirmModal";
import { Empty } from "@/components/Empty";
import { Field, Input } from "@/components/Field";
import { Screen } from "@/components/Screen";
import { SectionTitle } from "@/components/SectionTitle";
import { RADIUS, font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { usePendingQueue } from "@/src/hooks/useQueueStatus";
import { drainNow } from "@/src/offline/autoDrain";
import { editItem, remove, retryItem } from "@/src/offline/queue";
import { groupQueue, type QueueItem } from "@/src/offline/queueCore";

/** The top-level text and number fields of a payload: what a person can correct. */
const editable = (payload: any): [string, string | number][] =>
  Object.entries(payload ?? {}).filter(
    ([k, v]) =>
      (typeof v === "string" || typeof v === "number") &&
      !/^(clientRef|client_ref|eventType|action|type)$/.test(k),
  ) as [string, string | number][];

const when = (iso: string): string => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getDate()}/${d.getMonth() + 1} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/**
 * Everything saved on this phone and not yet on the server, grouped as the sync
 * sheet groups it: the ones that need attention first, then what is waiting by
 * kind. A recording the server refused is not sent again by itself: open it to fix
 * a figure and send it, send it as it is, or discard it.
 */
export default function Pending() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const queue = usePendingQueue();
  const groups = useMemo(() => groupQueue(queue), [queue]);
  const [editing, setEditing] = useState<QueueItem | null>(null);
  const [discarding, setDiscarding] = useState<QueueItem | null>(null);

  const retry = async (id: string) => {
    await retryItem(id);
    void drainNow();
  };

  return (
    <Screen title="Waiting to send" subtitle="Saved on this phone" back>
      {queue.length === 0 ? <Empty icon="cloud-check-outline" text="Everything is on the server" /> : null}
      {queue.length > 0 ? <Button label="Send now" icon="cloud-upload-outline" onPress={() => void drainNow()} /> : null}
      {groups.map((g) => (
        <View key={g.key}>
          <SectionTitle style={g.attention ? { color: c.danger } : undefined}>
            {g.title} · {g.items.length}
          </SectionTitle>
          {g.attention ? (
            <Banner tone="danger">The server refused these. They are not sent again until you fix or retry them.</Banner>
          ) : null}
          {g.items.map((m) => (
            <View key={m.id} style={s.card}>
              <Text style={s.label}>{m.label}</Text>
              <Text style={s.meta}>
                Saved {when(m.createdAt)}
                {m.attempts > 0 ? ` · tried ${m.attempts}×` : ""}
              </Text>
              {m.lastError ? <Text style={[s.err, !g.attention && { color: c.textMuted }]}>{m.lastError}</Text> : null}
              <View style={s.actions}>
                {g.attention ? (
                  <>
                    <View style={s.act}><Button label="Edit" variant="outline" onPress={() => setEditing(m)} /></View>
                    <View style={s.act}><Button label="Retry" onPress={() => void retry(m.id)} /></View>
                  </>
                ) : null}
                <View style={s.act}><Button label="Discard" variant="danger" onPress={() => setDiscarding(m)} /></View>
              </View>
            </View>
          ))}
        </View>
      ))}

      {editing ? <EditSheet item={editing} onClose={() => setEditing(null)} /> : null}
      <ConfirmModal
        visible={!!discarding}
        title="Discard this recording?"
        message={`${discarding?.label ?? ""} will be deleted from this phone and never sent.`}
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          const id = discarding?.id;
          setDiscarding(null);
          if (id) void remove(id);
        }}
        onCancel={() => setDiscarding(null)}
      />
    </Screen>
  );
}

function EditSheet({ item, onClose }: { item: QueueItem; onClose: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const fields = useMemo(() => editable(item.payload), [item]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(([k, v]) => [k, String(v)])),
  );

  const save = async () => {
    const next = { ...item.payload };
    for (const [k, orig] of fields) {
      const raw = values[k] ?? "";
      next[k] = typeof orig === "number" ? (raw.trim() === "" || Number.isNaN(Number(raw)) ? orig : Number(raw)) : raw;
    }
    await editItem(item.id, next);
    onClose();
    void drainNow();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={s.sheetTitle}>{item.label}</Text>
          {item.lastError ? <Banner tone="danger">{item.lastError}</Banner> : null}
          <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
            {fields.length === 0 ? (
              <Text style={s.meta}>Nothing here can be changed. Retry it, or discard it and record it again.</Text>
            ) : null}
            {fields.map(([k, v]) => (
              <Field key={k} label={k.replace(/([A-Z])/g, " $1").replace(/_/g, " ")}>
                <Input
                  value={values[k] ?? ""}
                  onChangeText={(t) => setValues((p) => ({ ...p, [k]: t }))}
                  keyboardType={typeof v === "number" ? "decimal-pad" : "default"}
                />
              </Field>
            ))}
          </ScrollView>
          <View style={s.actions}>
            <View style={s.act}><Button label="Cancel" variant="outline" onPress={onClose} /></View>
            <View style={s.act}><Button label="Save and send" icon="cloud-upload-outline" onPress={() => void save()} /></View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.bgSubtle,
      borderRadius: RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borderSubtle,
      padding: 12,
      marginBottom: 8,
    },
    label: { fontSize: 15, ...font("600"), color: c.text },
    meta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    err: { fontSize: 13, color: c.danger, marginTop: 6 },
    actions: { flexDirection: "row", gap: 8, marginTop: 10 },
    act: { flex: 1 },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.bg,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: 18,
      paddingBottom: 28,
    },
    sheetTitle: { fontSize: 17, ...font("700"), color: c.text, marginBottom: 10 },
  });
