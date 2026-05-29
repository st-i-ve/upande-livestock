import { getClient } from "@/src/services/api";

export type FileAsset = {
  uri: string;
  name: string;
  mimeType: string;
};

export type AttachFileInput = {
  doctype: string;
  docname: string;
  asset: FileAsset;
  /** Post-mortems are sensitive — default true (private File doc). */
  isPrivate?: boolean;
};

export type AttachFileResult = {
  fileName: string;
  fileUrl: string;
};

/**
 * Uploads a file to Frappe and attaches it to the given doc via the
 * standard /api/method/upload_file endpoint. Returns the resulting File
 * doc's name + URL. Throws on HTTP / Frappe errors.
 */
export async function attachFile(input: AttachFileInput): Promise<AttachFileResult> {
  const client = await getClient();
  const form = new FormData();
  // React Native FormData accepts the { uri, name, type } shape directly.
  form.append("file", {
    uri: input.asset.uri,
    name: input.asset.name,
    type: input.asset.mimeType,
  } as any);
  form.append("doctype", input.doctype);
  form.append("docname", input.docname);
  form.append("is_private", input.isPrivate === false ? "0" : "1");

  const res = await client.post("/api/method/upload_file", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const file = res.data?.message;
  if (!file?.name) {
    throw new Error("Upload succeeded but Frappe returned no File doc.");
  }
  return { fileName: file.name, fileUrl: file.file_url || "" };
}
