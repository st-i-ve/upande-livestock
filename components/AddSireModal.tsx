import React, { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { AnimalPickerButton } from "@/components/AnimalPickerButton";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Field, Input } from "@/components/Field";
import { Picker } from "@/components/Picker";
import { RADIUS, font } from "@/constants/theme";
import { useColors } from "@/src/hooks/useColors";
import { createSireItem, getSireItems, saveSire, type StrawItem } from "@/src/frappe/sires";
import { sireFromSaved, type Sire, type SireType } from "@/src/frappe/sireList";
import { extractFrappeError } from "@/src/services/api";

/**
 * Add a sire from the picker ("+ Add sire"): name (prefilled from the search), code, type, sexed,
 * breed, supplier, and the straw Item (searched, suggested from his name or code, or created) or,
 * for a live bull, his animal. Online only; the picker hides the row offline and for non-managers.
 */
export function AddSireModal({ visible, initialName, onClose, onAdded }: {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onAdded: (sire: Sire) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<SireType>("Semen");
  const [sexed, setSexed] = useState(false);
  const [breed, setBreed] = useState("");
  const [breeds, setBreeds] = useState<string[]>([]);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [item, setItem] = useState("");
  const [animal, setAnimal] = useState("");
  const [term, setTerm] = useState("");
  const [items, setItems] = useState<StrawItem[]>([]);
  const [suggested, setSuggested] = useState<StrawItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(initialName); setCode(""); setType("Semen"); setSexed(false); setBreed(""); setSupplier(null);
    setItem(""); setAnimal(""); setTerm(""); setError(null);
  }, [visible, initialName]);

  useEffect(() => {
    if (!visible) return;
    let live = true;
    const t = setTimeout(() => {
      getSireItems(name, code, item).then((r) => { if (live) { setItems(r.items); setSuggested(r.suggested); setBreeds(r.breeds); setSupplier(r.supplier); } }).catch(() => {});
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [visible, name, code, item]);

  const shown = useMemo(() => {
    const words = term.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter((i) => words.every((w) => `${i.label} ${i.value}`.toLowerCase().includes(w))).slice(0, 6);
  }, [items, term]);
  const chosen = items.find((i) => i.value === item);

  const makeItem = async () => {
    setBusy(true); setError(null);
    try {
      const made = await createSireItem(name, code);
      setItems((cur) => (cur.some((i) => i.value === made) ? cur : [...cur, { value: made, itemName: made, label: made }]));
      setItem(made);
    } catch (e) { setError(extractFrappeError(e)); }
    setBusy(false);
  };

  const save = async () => {
    if (!name.trim()) return setError("A sire needs a name.");
    if (type === "Live bull" && !animal) return setError("A live bull needs his animal record.");
    setBusy(true); setError(null);
    try {
      const made = await saveSire({ sireName: name.trim(), code: code.trim(), type, sexed, breed, semenItem: item, animal });
      onAdded(sireFromSaved(made, { sireName: name.trim(), code, type, semenItem: item, sexed, animal }));
    } catch (e) { setError(extractFrappeError(e)); }
    setBusy(false);
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.backdrop}>
        <View style={s.sheet}>
          <Text style={s.title}>Add sire</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <Field label="Name"><Input value={name} onChangeText={setName} /></Field>
            <Field label="Code"><Input value={code} onChangeText={setCode} autoCapitalize="characters" /></Field>
            <Field label="Type"><Picker value={type} onChange={(v) => setType(v as SireType)} options={["Semen", "Live bull"]} /></Field>
            {type === "Semen" ? (
              <>
                <Pressable onPress={() => setSexed(!sexed)} accessibilityRole="checkbox" accessibilityState={{ checked: sexed }}>
                  <Text style={s.check}>{sexed ? "[x]" : "[ ]"} Sexed semen</Text>
                </Pressable>
                <Field label="Semen straw (Item)" help="Picking this sire on a service issues this straw by itself.">
                  {chosen || item ? (
                    <Pressable onPress={() => setItem("")}><Text style={s.chosen}>{chosen?.label ?? item}  (tap to change)</Text></Pressable>
                  ) : (
                    <View style={{ gap: 6 }}>
                      <Input value={term} onChangeText={setTerm} placeholder="Search the straws…" />
                      {shown.map((i) => (
                        <Pressable key={i.value} onPress={() => setItem(i.value)} style={s.row}><Text style={s.rowText}>{i.label}</Text></Pressable>
                      ))}
                      {suggested ? (
                        <Pressable onPress={() => setItem(suggested.value)} style={[s.row, s.suggest]}>
                          <Text style={s.rowText}>Suggested: {suggested.itemName}. Tap to use.</Text>
                        </Pressable>
                      ) : name.trim() ? (
                        <Button variant="outline" label={busy ? "Creating…" : "Create the item"} disabled={busy} onPress={makeItem} />
                      ) : null}
                    </View>
                  )}
                </Field>
              </>
            ) : (
              <Field label="Live bull (animal)">
                <AnimalPickerButton
                  title="Select the bull"
                  placeholder="Search the bull…"
                  include={(a) => a.sex === "M"}
                  onPickSingle={(a) => setAnimal(a.id)}
                />
              </Field>
            )}
            <Field label="Breed"><Picker value={breed} onChange={setBreed} options={breeds} placeholder="Pick the breed" /></Field>
            {type === "Semen" ? (
              <Field label="Supplier" help="Taken from the straw item."><Input value={(item ? supplier : null) ?? ""} editable={false} placeholder="From the straw item" /></Field>
            ) : null}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button variant="outline" label="Cancel" onPress={onClose} style={{ flex: 1 }} />
            <Button label={busy ? "Saving…" : "Save sire"} loading={busy} disabled={busy} onPress={save} style={{ flex: 1 }} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 14, paddingBottom: 30, maxHeight: "92%" },
    title: { fontSize: 15, ...font("600"), color: c.text, marginBottom: 8 },
    check: { fontSize: 13, color: c.text },
    chosen: { fontSize: 13, ...font("600"), color: c.text },
    row: { paddingVertical: 8, paddingHorizontal: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, borderRadius: RADIUS.md },
    suggest: { borderColor: c.selected, backgroundColor: c.selectedBg },
    rowText: { fontSize: 12.5, color: c.text },
  });
