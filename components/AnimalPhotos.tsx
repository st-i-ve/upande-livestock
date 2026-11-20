import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { useOffline } from "@/components/OnlineOnlyNotice";
import { SectionTitle } from "@/components/SectionTitle";
import { RADIUS, font } from "@/constants/theme";
import { useAuthStore } from "@/src/auth/authStore";
import {
  fileUri,
  pickAnimalPhoto,
  type AnimalPhoto,
  type PhotoContext,
} from "@/src/frappe/animalPhotos";
import { getAnimalCase } from "@/src/frappe/treatment";
import { useQuery } from "@tanstack/react-query";
import { useAnimalGallery } from "@/src/hooks/useAnimalGallery";
import { useCanRecord } from "@/src/hooks/useCanRecord";
import { useAddAnimalPhoto } from "@/src/hooks/mutations";
import { useColors } from "@/src/hooks/useColors";
import { extractFrappeError } from "@/src/services/api";
import { STORAGE_KEYS, storage } from "@/src/services/storage";

/** Private files need the session cookie; public ones (what the phone uploads) do not. */
function useSource(path: string | null | undefined) {
  const base = useAuthStore((s) => s.instanceUrl);
  const [cookie, setCookie] = useState<string | null>(null);
  const isPrivate = !!path && path.startsWith("/private/");
  useEffect(() => {
    if (isPrivate) storage.getItem(STORAGE_KEYS.COOKIE).then(setCookie);
  }, [isPrivate]);
  if (!path || (isPrivate && !cookie)) return null;
  return { uri: fileUri(path, base), headers: isPrivate && cookie ? { Cookie: cookie } : undefined };
}

function Pic({ photo, thumb, style }: { photo: AnimalPhoto; thumb?: boolean; style: any }) {
  const src = useSource(thumb ? photo.thumb || photo.url : photo.url);
  // Opened full size: the strip's thumbnail (already on the phone) shows while the full one loads.
  const holder = useSource(!thumb && photo.thumb && photo.thumb !== photo.url ? photo.thumb : null);
  const c = useColors();
  return (
    <View style={[{ backgroundColor: c.bgMuted, overflow: "hidden" }, style]}>
      {src ? (
        <Image
          source={src}
          placeholder={holder ?? undefined}
          placeholderContentFit={thumb ? "cover" : "contain"}
          cachePolicy="memory-disk"
          recyclingKey={src.uri}
          contentFit={thumb ? "cover" : "contain"}
          transition={120}
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}
    </View>
  );
}

const shortDate = (d: string) => d.slice(0, 10);

/**
 * Her portfolio: a strip of thumbnails (date and source on each), a full-screen
 * viewer and, for a user who may record, an Add photo button. Online only to
 * add; what was loaded once still shows offline (expo-image's disk cache).
 */
export function AnimalPhotos({
  id,
  isCalf,
  hasCalved,
}: {
  id: string;
  /** Birth photo is offered for a calf, or for a dam who has calved. */
  isCalf: boolean;
  hasCalved: boolean;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { canRecord } = useCanRecord();
  const offline = useOffline();
  const q = useAnimalGallery(id);
  const photos = q.data?.photos ?? [];
  const [viewing, setViewing] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <View>
      <View style={s.head}>
        <SectionTitle style={{ marginBottom: 0 }}>Photos{photos.length ? ` · ${photos.length}` : ""}</SectionTitle>
        {canRecord ? (
          <Button
            label="Add photo"
            icon="camera"
            variant="outline"
            disabled={offline}
            onPress={() => setAdding(true)}
            style={s.addBtn}
          />
        ) : null}
      </View>
      {offline && canRecord ? <Text style={s.note}>Needs connection to add a photo.</Text> : null}
      {q.data?.cached ? <Text style={s.note}>Showing the photos saved on this phone.</Text> : null}
      {q.isLoading ? null : q.error && !photos.length ? (
        <Banner tone="warning">{extractFrappeError(q.error)}</Banner>
      ) : photos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
          {photos.map((p, i) => (
            <Pressable
              key={`${p.url}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${p.source} photo, ${shortDate(p.date)}`}
              onPress={() => setViewing(i)}
              style={s.tile}
            >
              <Pic photo={p} thumb style={s.thumb} />
              <View style={s.chip}>
                <Text style={s.chipText} numberOfLines={1}>{p.source}</Text>
              </View>
              <Text style={s.tileDate}>{shortDate(p.date)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Text style={s.note}>No photos yet.</Text>
      )}

      {viewing !== null ? (
        <Viewer photos={photos} start={viewing} onClose={() => setViewing(null)} />
      ) : null}
      {adding ? (
        <AddSheet id={id} isCalf={isCalf} hasCalved={hasCalved} onClose={() => setAdding(false)} />
      ) : null}
    </View>
  );
}

/** A photo that pinches up to 4x, pans while zoomed and double-taps in and out.
 *  Unzoomed, the pan is off so the pager's swipe moves to the next photo. */
function ZoomPic({ photo, width, height }: { photo: AnimalPhoto; width: number; height: number }) {
  const scale = useSharedValue(1);
  const base = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const sx = useSharedValue(0);
  const sy = useSharedValue(0);
  const [zoomed, setZoomed] = useState(false);
  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    base.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    sx.value = 0;
    sy.value = 0;
  };
  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(4, Math.max(1, base.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        reset();
        runOnJS(setZoomed)(false);
      } else {
        base.value = scale.value;
        runOnJS(setZoomed)(true);
      }
    });
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((e) => {
      const mx = (width * (scale.value - 1)) / 2;
      const my = (height * (scale.value - 1)) / 2;
      x.value = Math.min(mx, Math.max(-mx, sx.value + e.translationX));
      y.value = Math.min(my, Math.max(-my, sy.value + e.translationY));
    })
    .onEnd(() => {
      sx.value = x.value;
      sy.value = y.value;
    });
  const dbl = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        reset();
        runOnJS(setZoomed)(false);
      } else {
        scale.value = withTiming(2.5);
        base.value = 2.5;
        runOnJS(setZoomed)(true);
      }
    });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));
  return (
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, dbl)}>
      <Animated.View style={[{ width, height, backgroundColor: "#000" }, style]}>
        <Pic photo={photo} style={{ width, height, backgroundColor: "#000" }} />
      </Animated.View>
    </GestureDetector>
  );
}

export function Viewer({ photos, start, onClose }: { photos: AnimalPhoto[]; start: number; onClose: () => void }) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(start);
  const p = photos[index];
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={s.viewer}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          keyExtractor={(x, i) => `${x.url}-${i}`}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => <ZoomPic photo={item} width={width} height={height * 0.72} />}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={s.close}>
          <MaterialCommunityIcons name="close" size={26} color="#fff" />
        </Pressable>
        {p ? (
          <View style={s.info}>
            <Text style={s.infoCount}>{index + 1} / {photos.length}</Text>
            {p.caption ? <Text style={s.infoCaption}>{p.caption}</Text> : null}
            <Text style={s.infoLine}>
              {p.source} · {shortDate(p.date)}
              {p.uploaded_by ? ` · ${p.uploaded_by}` : ""}
            </Text>
            {p.ref_doctype !== "Animal" ? <Text style={s.infoRef}>{p.ref_name}</Text> : null}
          </View>
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

type Purpose = { key: PhotoContext; label: string; ref?: string; hint?: string };

function AddSheet({
  id,
  isCalf,
  hasCalved,
  onClose,
}: {
  id: string;
  isCalf: boolean;
  hasCalved: boolean;
  onClose: () => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const addPhoto = useAddAnimalPhoto();
  const caseQ = useQuery({
    queryKey: ["animal-case", id],
    queryFn: () => getAnimalCase(id),
    staleTime: 0,
    retry: 0,
  });
  const open = caseQ.data?.open_case ?? null;
  const purposes: Purpose[] = [
    ...(open
      ? [{ key: "health_case" as const, label: "Health case", ref: open.name, hint: `${open.name}, open since ${open.opened_date}` }]
      : []),
    ...(isCalf || hasCalved
      ? [{ key: "birth" as const, label: "Birth", hint: isCalf ? "Her birth record" : "Her latest calving" }]
      : []),
    { key: "profile", label: "Profile photo", hint: "Becomes her picture; the old one stays in her photos" },
  ];
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const go = async (p: Purpose, source: "camera" | "gallery") => {
    setNote(null);
    const r = await pickAnimalPhoto(source);
    if (r.status === "cancelled") return;
    if (r.status === "denied") return setNote("Camera not allowed. Use the gallery, or allow the camera in settings.");
    if (r.status === "failed") return Alert.alert("Photo not added", r.message);
    setBusy(true);
    try {
      // Kept on the phone and sent when there is signal.
      await addPhoto.mutateAsync({ animal: id, asset: r.asset, context: p.key, ref: p.ref });
      onClose();
    } catch (e) {
      if (alive.current) setNote(extractFrappeError(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={busy ? undefined : onClose}>
        <Pressable style={s.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={s.sheetTitle}>What is this photo for?</Text>
          {caseQ.isLoading ? <Text style={s.note}>Looking for her open health case…</Text> : null}
          {purposes.map((p) => (
            <View key={p.key} style={s.purpose}>
              <Text style={s.purposeLabel}>{p.label}</Text>
              {p.hint ? <Text style={s.note}>{p.hint}</Text> : null}
              <View style={s.purposeBtns}>
                <Button label="Camera" icon="camera" variant="outline" disabled={busy} onPress={() => go(p, "camera")} style={s.addBtn} />
                <Button label="Gallery" icon="image" variant="outline" disabled={busy} onPress={() => go(p, "gallery")} style={s.addBtn} />
              </View>
            </View>
          ))}
          {busy ? <Text style={s.note}>Uploading…</Text> : null}
          {note ? <Banner tone="danger">{note}</Banner> : null}
          <Button label="Cancel" variant="link" disabled={busy} onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: ReturnType<typeof useColors>) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14, marginBottom: 8 },
    addBtn: { flexGrow: 0, paddingVertical: 6 },
    note: { fontSize: 12, color: c.textSubtle, marginBottom: 6 },
    strip: { gap: 10, paddingBottom: 4 },
    tile: { width: 104 },
    thumb: { width: 104, height: 104, borderRadius: RADIUS.md },
    chip: {
      position: "absolute", top: 6, left: 6, backgroundColor: "rgba(0,0,0,0.6)",
      borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, maxWidth: 92,
    },
    chipText: { color: "#fff", fontSize: 10, ...font("600") },
    tileDate: { fontSize: 11, color: c.textSubtle, marginTop: 3 },
    viewer: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
    close: { position: "absolute", top: 44, right: 16, padding: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20 },
    info: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 18, paddingBottom: 32, backgroundColor: "rgba(0,0,0,0.65)", gap: 3 },
    infoCount: { color: "#bbb", fontSize: 11 },
    infoCaption: { color: "#fff", fontSize: 15, ...font("600") },
    infoLine: { color: "#ddd", fontSize: 13 },
    infoRef: { color: "#999", fontSize: 11, ...font("400") },
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.bg, padding: 18, paddingBottom: 28, borderTopLeftRadius: 18, borderTopRightRadius: 18, gap: 8 },
    sheetTitle: { fontSize: 16, ...font("700"), color: c.text, marginBottom: 4 },
    purpose: { backgroundColor: c.bgMuted, padding: 12, borderRadius: RADIUS.md, gap: 4 },
    purposeLabel: { fontSize: 14, ...font("600"), color: c.text },
    purposeBtns: { flexDirection: "row", gap: 8, marginTop: 4 },
  });
