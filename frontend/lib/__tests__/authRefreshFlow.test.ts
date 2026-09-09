import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authedFetch,
  ApiRequestError,
  expireSession,
  __setRedirectToLogin,
} from "@/lib/api";
import { getAccessToken, clearCurrentUser } from "@/lib/session";

vi.mock("@/lib/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/session")>();
  let token: string | null = "expired-access-token";
  return {
    ...actual,
    getAccessToken: () => token,
    saveAccessToken: (t: string) => {
      token = t;
    },
    clearAccessToken: () => {
      token = null;
    },
    clearCurrentUser: vi.fn(),
  };
});

const API = "https://api.example.test";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Each spec is either an HTTP status (401…) or a response body (200). */
function sequenceFetch(...specs: Array<number | Record<string, unknown>>): ReturnType<typeof vi.fn> {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const spec = specs.shift();
    if (spec === undefined) throw new Error("fetch called more times than mocked");
    return typeof spec === "number" ? jsonResponse({ error: "expired" }, spec) : jsonResponse(spec);
  });
}

describe("auth refresh flow", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_API_URL = API;
    vi.mocked(clearCurrentUser).mockClear();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    __setRedirectToLogin(() => {
      /* default is a no-op under node (window undefined) */
    });
  });

  it("refreshes on 401 and retries the original request with the new token", async () => {
    const fetchMock = sequenceFetch(
      401,                                          // 1. bio-data → expired token
      { accessToken: "fresh-access-token" },        // 2. POST /api/auth/refresh
      { bioData: null }                             // 3. retried bio-data
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await authedFetch("/api/bio-data");

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ bioData: null });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [first, refresh, retry] = fetchMock.mock.calls;
    expect(String(first[0])).toBe(`${API}/api/bio-data`);
    expect(String(refresh[0])).toBe(`${API}/api/auth/refresh`);
    expect(String(retry[0])).toBe(`${API}/api/bio-data`);

    const headers = retry[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer fresh-access-token");
    expect(getAccessToken()).toBe("fresh-access-token");
  });

  it("expires the session and redirects to /login when the refresh fails", async () => {
    const fetchMock = sequenceFetch(
      401,                // 1. dues → expired token
      401,                // 2. refresh rejected (refresh token invalid/expired)
      { up: true }        // 3. best-effort logout (revoke cookie)
    );
    vi.stubGlobal("fetch", fetchMock);

    const redirect = vi.fn();
    __setRedirectToLogin(redirect);

    await expect(authedFetch("/api/dues")).rejects.toMatchObject({ status: 401 });

    expect(getAccessToken()).toBeNull();
    expect(vi.mocked(clearCurrentUser)).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
    // refresh endpoint was hit once, then a best-effort logout fired
    const calls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(calls.filter((u) => u.endsWith("/api/auth/refresh")).length).toBe(1);
    expect(calls.filter((u) => u.endsWith("/api/auth/logout")).length).toBe(1);
  });

  it("fires exactly one refresh for concurrent 401s and retries them all", async () => {
    const fetchMock = sequenceFetch(
      401,                                           // a1
      401,                                           // b1
      401,                                           // c1
      { accessToken: "fresh-access-token" },         // single refresh
      { data: "a" },                                 // a2 (retry)
      { data: "b" },                                 // b2 (retry)
      { data: "c" }                                  // c2 (retry)
    );
    vi.stubGlobal("fetch", fetchMock);

    const results = await Promise.all([
      authedFetch("/api/dues"),
      authedFetch("/api/dues"),
      authedFetch("/api/dues"),
    ]);

    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(await results[0].json()).toEqual({ data: "a" });
    expect(await results[1].json()).toEqual({ data: "b" });
    expect(await results[2].json()).toEqual({ data: "c" });

    // Only ONE refresh request, and it fired before any of the retries.
    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/auth/refresh")
    );
    expect(refreshCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(getAccessToken()).toBe("fresh-access-token");
  });

  it("does not retry the refresh after a second 401 (no refresh loop)", async () => {
    const fetchMock = sequenceFetch(
      401,                     // 1. request → expired
      { accessToken: "new" },  // 2. refresh OK
      401                      // 3. retried request still 401 → surface error, do NOT refresh again
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(authedFetch("/api/admin/members/pending")).rejects.toMatchObject({
      status: 401,
    });

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/auth/refresh")
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("expireSession clears the token and triggers the configured redirect", async () => {
    vi.stubGlobal("fetch", sequenceFetch({ up: true }) as ReturnType<typeof vi.fn>);
    const redirect = vi.fn();
    __setRedirectToLogin(redirect);

    expireSession();

    expect(getAccessToken()).toBeNull();
    expect(vi.mocked(clearCurrentUser)).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledTimes(1);
  });

  it("rethrows a non-401 failure unchanged (no refresh attempt)", async () => {
    const fetchMock = sequenceFetch(403, { error: "not verified" }) as ReturnType<typeof vi.fn>;
    vi.stubGlobal("fetch", fetchMock);

    const promise = authedFetch("/api/auth/me");
    await expect(promise).rejects.toBeInstanceOf(ApiRequestError);
    await expect(promise).rejects.toMatchObject({ status: 403 });

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/api/auth/refresh")
    );
    expect(refreshCalls).toHaveLength(0);
  });
});