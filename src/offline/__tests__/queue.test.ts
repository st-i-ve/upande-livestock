import { beforeEach, describe, expect, it } from "../../__tests__/jestLike.ts";
import {
  MAX_RETRIES, backoffMs, classify, createQueue, groupQueue, makeUuid, type Handler, type Kv,
} from "../queueCore.ts";

const memoryKv = () => {
  const box: { v: string | null } = { v: null };
  const kv: Kv = { get: async () => box.v, set: async (v) => { box.v = v; } };
  return { box, kv };
};

const net = () => Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" });
const refused = () => Object.assign(new Error("Animal has no open service"), { isServerRejection: true });
const http = (status: number) => Object.assign(new Error("http"), { response: { status } });

let clock = 1_000_000;
const make = (kv: Kv) => createQueue({ kv, now: () => clock });
const entry = (id: string, type: string, keys?: string[]) => ({ id, type, payload: { id }, label: id, keys });

describe("classify", () => {
  it("tells a dead network, a refusal and a server fault apart", () => {
    expect(classify(net())).toBe("network");
    expect(classify(new Error("x"))).toBe("network");
    expect(classify(refused())).toBe("rejected");
    expect(classify(http(417))).toBe("rejected");
    expect(classify(http(403))).toBe("rejected");
    expect(classify(http(500))).toBe("retry");
    expect(classify(http(429))).toBe("retry");
    expect(classify(http(401))).toBe("network");
  });
  it("makes distinct uuids", () => {
    const a = makeUuid();
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
    expect(a === makeUuid()).toBe(false);
  });
});

describe("saving first", () => {
  beforeEach(() => { clock = 1_000_000; });

  it("holds the recording in the queue before any send is tried", async () => {
    const { kv, box } = memoryKv();
    const q = make(kv);
    let sent = 0;
    await q.enqueue(entry("a", "AnimalEvent", ["cow1"]));
    expect(sent).toBe(0);
    expect(JSON.parse(box.v as string)).toHaveLength(1);
    const handlers: Record<string, Handler> = { AnimalEvent: async () => { sent++; return { ok: true }; } };
    await q.drain(handlers);
    expect(sent).toBe(1);
    expect((await q.load())).toHaveLength(0);
  });

  it("survives a restart: a new queue over the same storage still has it", async () => {
    const { kv } = memoryKv();
    await make(kv).enqueue(entry("a", "Weights", ["cow1"]));
    const after = make(kv);
    const items = await after.load();
    expect(items.map((i) => i.id)).toEqual(["a"]);
    const sent: string[] = [];
    await after.drain({ Weights: async (p) => { sent.push(p.id); return {}; } });
    expect(sent).toEqual(["a"]);
  });

  it("keeps a recording once when the same client_ref is saved twice", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("same", "AnimalEvent"));
    await q.enqueue(entry("same", "AnimalEvent"));
    expect(await q.load()).toHaveLength(1);
  });

  it("hands the client_ref to the sender, so a resend is the server's to dedupe", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("ref-1", "AnimalEvent"));
    const seen: string[] = [];
    // First send reaches the server but the reply is lost: network error, item stays.
    await q.drain({ AnimalEvent: async (_p, item) => { seen.push(item.id); throw net(); } });
    expect((await q.load())).toHaveLength(1);
    // Resend carries the same ref; the server answers duplicate and it counts as sent.
    const res = await q.drain({ AnimalEvent: async (_p, item) => { seen.push(item.id); return { ok: true, duplicate: true }; } }, { force: true });
    expect(seen).toEqual(["ref-1", "ref-1"]);
    expect(res.succeeded).toBe(1);
    expect((await q.load())).toHaveLength(0);
  });
});

describe("ordering", () => {
  beforeEach(() => { clock = 1_000_000; });

  it("sends oldest first", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    for (const id of ["1", "2", "3"]) await q.enqueue(entry(id, "T", [`cow${id}`]));
    const order: string[] = [];
    await q.drain({ T: async (p) => { order.push(p.id); return {}; } });
    expect(order).toEqual(["1", "2", "3"]);
  });

  it("holds a PD behind a service that needs attention, but not another cow", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("service", "S", ["cow1"]));
    await q.enqueue(entry("pd", "P", ["cow1"]));
    await q.enqueue(entry("other", "P", ["cow2"]));
    const sent: string[] = [];
    await q.drain({
      S: async () => { throw refused(); },
      P: async (p) => { sent.push(p.id); return {}; },
    });
    expect(sent).toEqual(["other"]);
    const left = await q.load();
    expect(left.map((i) => i.id)).toEqual(["service", "pd"]);
    expect(left[0].status).toBe("attention");
    expect(left[1].status).toBe("pending");
  });

  it("releases the PD once the service is edited and sent", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("service", "S", ["cow1"]));
    await q.enqueue(entry("pd", "P", ["cow1"]));
    let fixed = false;
    const handlers = {
      S: async (p: any) => { if (!fixed) throw refused(); return { got: p.date }; },
      P: async () => ({}),
    };
    await q.drain(handlers);
    await q.edit("service", { id: "service", date: "2026-11-01" });
    fixed = true;
    const res = await q.drain(handlers);
    expect(res.succeeded).toBe(2);
    expect(await q.load()).toHaveLength(0);
  });

  it("sends a photo after its record (queued after it, same key)", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("rec", "Treatment", ["cow1"]));
    await q.enqueue(entry("photo", "AnimalPhoto", ["cow1"]));
    const order: string[] = [];
    await q.drain({
      Treatment: async () => { order.push("rec"); throw http(503); },
      AnimalPhoto: async () => { order.push("photo"); return {}; },
    });
    expect(order).toEqual(["rec"]);
  });
});

describe("retry versus needs attention", () => {
  beforeEach(() => { clock = 1_000_000; });

  it("a dead network stops the pass, costs no attempt, and keeps everything pending", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("a", "T", ["c1"]));
    await q.enqueue(entry("b", "T", ["c2"]));
    let calls = 0;
    const res = await q.drain({ T: async () => { calls++; throw net(); } });
    expect(calls).toBe(1);
    expect(res.succeeded).toBe(0);
    const [a, b] = await q.load();
    expect(a.attempts).toBe(0);
    expect(a.status).toBe("pending");
    expect(b.lastError).toBe(null);
  });

  it("a refusal goes to needs attention and is not sent again", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("a", "T", ["c1"]));
    let calls = 0;
    const h = { T: async () => { calls++; throw refused(); } };
    await q.drain(h, { force: true });
    await q.drain(h, { force: true });
    await q.drain(h, { force: true });
    expect(calls).toBe(1);
    const [a] = await q.load();
    expect(a.status).toBe("attention");
    expect(a.lastError).toBe("Animal has no open service");
  });

  it("a 4xx is a refusal, a 5xx is retried with backoff", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("bad", "A", ["c1"]));
    await q.enqueue(entry("flaky", "B", ["c2"]));
    await q.drain({ A: async () => { throw http(417); }, B: async () => { throw http(502); } });
    const [bad, flaky] = await q.load();
    expect(bad.status).toBe("attention");
    expect(flaky.status).toBe("pending");
    expect(flaky.nextAttemptAt).toBe(clock + backoffMs(1));
  });

  it("the timed drain waits out the backoff; reconnect and foreground (force) do not", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("flaky", "B", ["c2"]));
    let calls = 0;
    const h = { B: async () => { calls++; throw http(502); } };
    await q.drain(h);
    await q.drain(h);
    expect(calls).toBe(1);
    clock += backoffMs(1) + 1;
    await q.drain(h);
    expect(calls).toBe(2);
    await q.drain(h, { force: true });
    expect(calls).toBe(3);
  });

  it("backoff grows and is capped", () => {
    expect(backoffMs(2)).toBe(backoffMs(1) * 2);
    expect(backoffMs(40)).toBe(30 * 60_000);
  });

  it("gives up on a server fault after MAX_RETRIES", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("flaky", "B", ["c2"]));
    for (let i = 0; i < MAX_RETRIES; i++) await q.drain({ B: async () => { throw http(500); } }, { force: true });
    expect((await q.load())[0].status).toBe("attention");
  });

  it("discarding removes it, and reports it gone so its photo file can go", async () => {
    const { kv } = memoryKv();
    const gone: string[] = [];
    const q = createQueue({ kv, now: () => clock, onGone: (xs) => xs.forEach((x) => gone.push(x.id)) });
    await q.enqueue(entry("a", "T"));
    await q.remove("a");
    expect(await q.load()).toHaveLength(0);
    expect(gone).toEqual(["a"]);
  });

  it("an item with no sender is a refusal, not a crash", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("a", "Gone"));
    await q.drain({});
    expect((await q.load())[0].status).toBe("attention");
  });
});

describe("groups", () => {
  it("lists needs attention first, then waiting records by kind, photos last", async () => {
    const { kv } = memoryKv();
    const q = make(kv);
    await q.enqueue(entry("bad", "Weights", ["w"]));
    await q.drain({ Weights: async () => { throw refused(); } });
    await q.enqueue(entry("p", "AnimalPhoto"));
    await q.enqueue(entry("m", "MilkRecording"));
    await q.enqueue(entry("e", "AnimalEvent", ["c"]));
    const g = groupQueue(await q.load());
    expect(g.map((x) => x.key)).toEqual(["attention", "MilkRecording", "AnimalEvent", "AnimalPhoto"]);
  });
});
