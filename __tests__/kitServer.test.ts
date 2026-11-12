const mockCfg: Record<string, unknown> = { endpoints: { versions: "/api/method/frappe.utils.change_log.get_versions" } };
const mockRequest = jest.fn();
const mockGet = jest.fn();

jest.mock("@upande/mobile-kit", () => ({ getConfig: () => mockCfg }));
jest.mock("@/src/services/api", () => ({ getClient: async () => ({ request: mockRequest, get: mockGet }) }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { applyKitServer, checkKitServer, isKitServerCall, kitApi, useKitServer } from "@/src/kit/kitServer";

beforeEach(() => {
  mockRequest.mockReset();
  mockGet.mockReset();
  useKitServer.setState({ ready: false, site: null });
});

describe("the link to Upande Mobile is held off until the site has it", () => {
  it("knows its calls", () => {
    expect(isKitServerCall("/api/method/upande_mobile.api.register_install")).toBe(true);
    expect(isKitServerCall("/api/method/frappe.utils.change_log.get_versions")).toBe(false);
  });

  it("refuses an Upande Mobile call before it leaves the phone while the site lacks the app", async () => {
    await expect(kitApi({ method: "POST", url: "/api/method/upande_mobile.api.monitor.ingest" })).rejects.toThrow(/not installed/);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("lets other calls through, on the app's own signed-in client", async () => {
    mockRequest.mockResolvedValue({ data: { message: { frappe: {} } } });
    const out = await kitApi({ method: "GET", url: "/api/method/frappe.utils.change_log.get_versions" });
    expect(out).toEqual({ message: { frappe: {} } });
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it("switches monitoring, support and push with it", () => {
    applyKitServer(false);
    expect(mockCfg).toMatchObject({ monitor: { enabled: false }, support: false, push: false });
    applyKitServer(true);
    expect(mockCfg).toMatchObject({ monitor: { enabled: true }, support: true, push: true });
  });

  it("turns on once the site lists upande_mobile, and its calls then go out", async () => {
    mockGet.mockResolvedValue({ data: { message: { frappe: {}, erpnext: {} } } });
    await checkKitServer("https://farm.example");
    expect(useKitServer.getState().ready).toBe(false);

    mockGet.mockResolvedValue({ data: { message: { frappe: {}, upande_mobile: { version: "1.0.0" } } } });
    await checkKitServer("https://farm.example");
    expect(useKitServer.getState().ready).toBe(true);
    mockRequest.mockResolvedValue({ data: { message: "ok" } });
    await expect(kitApi({ method: "POST", url: "/api/method/upande_mobile.api.register_install" })).resolves.toEqual({ message: "ok" });
  });

  it("offline, it keeps what it last knew", async () => {
    useKitServer.setState({ ready: true, site: "https://farm.example" });
    mockGet.mockRejectedValue(new Error("Network Error"));
    await checkKitServer("https://farm.example");
    expect(useKitServer.getState().ready).toBe(true);
  });
});
