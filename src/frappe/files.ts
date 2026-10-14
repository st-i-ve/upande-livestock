import { getClient } from "@/src/services/api";

export type FileAsset = {
  uri: string;
  name: string;
  mimeType: string;
};

/**
 * Upload a file that is not attached to any document yet and return its URL —
 * for a picture the server will adopt as a field value (a calf's `image`).
 */
export async function uploadFile(asset: FileAsset, isPrivate = false): Promise<string> {
  const client = await getClient();
  const form = new FormData();
  form.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType } as any);
  form.append("is_private", isPrivate ? "1" : "0");
  const res = await client.post("/api/method/upload_file", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = res.data?.message?.file_url;
  if (!url) throw new Error("Upload succeeded but Frappe returned no file URL.");
  return url as string;
}
