import React from "react";

import { Banner } from "@/components/Banner";
import type { RecordResult } from "@/src/shoats/api";

/** The outcome of an entry: error, what was saved, and the server's warnings. */
export function SaveBanners({ error, note, result }: { error: string | null; note: string | null; result: RecordResult | null }) {
  return (
    <>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {note ? <Banner tone="success">{note}</Banner> : null}
      {(result?.warnings ?? []).map((w) => (
        <Banner key={w} tone="warning">{w}</Banner>
      ))}
    </>
  );
}
