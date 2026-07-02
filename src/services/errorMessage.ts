// Turn a raw server/system message (often Frappe HTML like
// `<strong>x</strong> <a href="...">label</a>`) into clean, human-friendly
// text: keep the meaningful words, drop the markup, decode entities, and tidy
// whitespace. Newlines are preserved so multi-line messages stay readable.

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

export function cleanErrorMessage(raw: string | null | undefined): string {
  if (raw == null) return "Something went wrong.";
  let s = String(raw);

  // Drop HTML tags but keep their inner text: <strong>1.0</strong> -> 1.0,
  // <a href="...">Store - KR</a> -> Store - KR.
  s = s.replace(/<[^>]+>/g, "");

  // Decode the common HTML entities that survive.
  s = s.replace(/&[a-zA-Z#0-9]+;/g, (m) => ENTITIES[m] ?? m);

  // Collapse horizontal whitespace, trim each line, cap blank-line runs.
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s || "Something went wrong.";
}
