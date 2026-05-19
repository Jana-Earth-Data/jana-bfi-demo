export class ApiError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type QueryValue = string | number | boolean | undefined | null;

export type FetchOptions = {
  params?: Record<string, QueryValue>;
  token?: string | null;
  init?: RequestInit;
};

export async function apiFetch<T>(
  path: string,
  optsOrParams?: FetchOptions | Record<string, QueryValue>,
  init?: RequestInit
): Promise<T> {
  let params: Record<string, QueryValue> | undefined;
  let token: string | null | undefined;
  let reqInit: RequestInit | undefined;

  if (optsOrParams && ("token" in optsOrParams || "params" in optsOrParams || "init" in optsOrParams)) {
    const opts = optsOrParams as FetchOptions;
    params = opts.params;
    token = opts.token;
    reqInit = opts.init;
  } else {
    params = optsOrParams as Record<string, QueryValue> | undefined;
    reqInit = init;
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL;

  if (!baseUrl) {
    throw new ApiError("NEXT_PUBLIC_API_URL is not configured.");
  }

  const url = new URL(path, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(reqInit?.headers as Record<string, string> ?? {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    ...reqInit,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    let body: unknown = undefined;
    try {
      body = await response.json();
    } catch {
      body = await response.text().catch(() => undefined);
    }

    throw new ApiError(
      `Request failed for ${path} with status ${response.status}`,
      response.status,
      body
    );
  }

  return response.json() as Promise<T>;
}

export type PaginatedResponse<T> = {
  count?: number;
  results?: T[];
  next?: string | null;
};

const MAX_PAGES = 20;

export async function apiFetchAll<T>(
  path: string,
  opts: FetchOptions & { maxPages?: number } = {}
): Promise<{ count: number; results: T[] }> {
  const limit = opts.maxPages ?? MAX_PAGES;
  const t0 = Date.now();
  const firstPage = await apiFetch<PaginatedResponse<T>>(path, opts);
  console.log(`[apiFetchAll] ${path} page 1: ${(firstPage.results ?? []).length} rows, ${Date.now() - t0}ms (total count: ${firstPage.count ?? "?"})`);

  const totalCount = firstPage.count ?? (firstPage.results ?? []).length;
  const allResults = [...(firstPage.results ?? [])];

  let nextUrl = firstPage.next;
  let page = 1;

  while (nextUrl && page < limit) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

    const tp = Date.now();
    const res = await fetch(nextUrl, { headers, cache: "no-store" });
    if (!res.ok) break;

    const data: PaginatedResponse<T> = await res.json();
    allResults.push(...(data.results ?? []));
    page++;
    console.log(`[apiFetchAll] ${path} page ${page}: ${(data.results ?? []).length} rows, ${Date.now() - tp}ms`);
    nextUrl = data.next;
  }

  console.log(`[apiFetchAll] ${path} DONE: ${page} page(s), ${allResults.length} total rows, ${Date.now() - t0}ms total`);
  return { count: totalCount, results: allResults };
}
