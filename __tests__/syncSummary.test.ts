import { agoText, summaryText } from "@/src/sync/syncStatus";

const now = Date.UTC(2026, 10, 11, 12, 0, 0);
const min = 60_000;

describe("agoText", () => {
  it("counts minutes, then hours, then names the day", () => {
    expect(agoText(now - 20_000, now)).toBe("just now");
    expect(agoText(now - 2 * min, now)).toBe("2 min ago");
    expect(agoText(now - 3 * 60 * min, now)).toBe("3 h ago");
    expect(agoText(now - 3 * 24 * 60 * min, now)).toMatch(/^\d+\/\d+$/);
  });
});

describe("summaryText", () => {
  it("cattle: animals on the phone and how fresh", () => {
    expect(summaryText({ what: { animals: 475 }, syncedAt: now - 2 * min, now })).toBe("All synced · 475 animals · 2 min ago");
    expect(summaryText({ what: { animals: 1 }, syncedAt: now, now })).toBe("All synced · 1 animal · just now");
    expect(summaryText({ what: { animals: 1475 }, syncedAt: now, now })).toBe("All synced · 1,475 animals · just now");
  });
  it("shoats: herds and head", () => {
    expect(summaryText({ what: { herds: 5, head: 420 }, syncedAt: now - min, now })).toBe("All synced · 5 herds · 420 head · 1 min ago");
  });
  it("adds a record kept for Continue recording", () => {
    expect(summaryText({ what: { animals: 475 }, syncedAt: now - 2 * min, now, waiting: 1 })).toBe(
      "All synced · 475 animals · 2 min ago · 1 record waiting",
    );
  });
  it("says so when offline, failed or never synced", () => {
    expect(summaryText({ what: { animals: 475 }, syncedAt: now - 3 * 60 * min, now, offline: true })).toBe("Offline · 475 animals · 3 h ago");
    expect(summaryText({ what: { animals: 475 }, syncedAt: now - 5 * min, now, failed: true })).toBe("Last sync failed · 475 animals · 5 min ago");
    expect(summaryText({ what: { animals: null }, syncedAt: null, now })).toBe("Not synced yet");
  });
});
