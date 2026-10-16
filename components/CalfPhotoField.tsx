import React, { useMemo, useState } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { RADIUS } from "@/constants/theme";
import { pickCalfPhoto, type PickOutcome } from "@/src/frappe/calfPhoto";
import type { FileAsset } from "@/src/frappe/files";
import { useColors } from "@/src/hooks/useColors";

/**
 * Optional photo of one calf. Camera first, gallery as the fallback (camera
 * refused or unavailable). It only holds a local file reference; it is uploaded when the calving is submitted.
 */
export function CalfPhotoField({
  value,
  onChange,
  label = "Calf photo",
  help = "Optional. It becomes the calf's picture on its record. It is uploaded when you submit.",
}: {
  value: FileAsset | null;
  onChange: (asset: FileAsset | null) => void;
  label?: string;
  help?: string;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const [note, setNote] = useState<string | null>(null);

  const take = async (source: "camera" | "gallery") => {
    setNote(null);
    const r: PickOutcome = await pickCalfPhoto(source);
    if (r.status === "picked") {
      return onChange(r.asset);
    }
    if (r.status === "denied") {
      setNote("Camera not allowed. Choose a photo from the gallery, or allow the camera in your phone settings.");
    } else if (r.status === "failed") {
      Alert.alert("Photo not added", r.message);
    }
  };

  return (
    <Field
      label={label}
      help={help}
    >
      {value ? <Image source={{ uri: value.uri }} style={s.preview} resizeMode="cover" /> : null}
      <View style={s.row}>
        <Button
          label={value ? "Retake" : "Take photo"}
          icon="camera"
          variant="outline"
          onPress={() => take("camera")}
          style={s.btn}
        />
        <Button
          label="Gallery"
          icon="image"
          variant="outline"
          onPress={() => take("gallery")}
          style={s.btn}
        />
        {value ? <Button label="Remove" variant="link" onPress={() => onChange(null)} /> : null}
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </Field>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    preview: {
      width: "100%",
      height: 180,
      borderRadius: RADIUS.md,
      backgroundColor: c.bgMuted,
      marginBottom: 8,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    btn: { flexGrow: 0 },
    note: { color: c.textSubtle, fontSize: 12, marginTop: 6 },
  });
