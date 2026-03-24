import axios from "axios";

export type LoadTestLifecycleStatus =
  | "IDLE"
  | "STARTING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export interface StartLoadTestParams {
  users: number;
  quantity: number;
  spawnRate: number;
  durationMs: number;
}

export interface StartLoadTestResponse {
  testId?: string;
}

export interface TimeSeriesPoint {
  t: number;
  v: number;
}

export interface LoadTestMetricPoint {
  timestamp: number;
  rps: number;
  latency: number;
}

export interface LoadTestStatusResponse {
  testId?: string;
  status?: string;
  completed?: boolean;

  users?: number;
  spawnRate?: number;
  durationMs?: number;
  quantity?: number;

  totalRequests?: number;
  successCount?: number;
  failureCount?: number;
  successPercent?: number;
  avgLatencyMs?: number;
  p95LatencyMs?: number;
  p95Latency?: number;

  remainingStock?: number;
  initialStock?: number;
  soldCount?: number;
  oversellDetected?: boolean;

  metrics?: LoadTestMetricPoint[];

  rps?: TimeSeriesPoint[];
  latencyMs?: TimeSeriesPoint[];
}

export interface HistoryTestRecord {
  testId: string;
  users?: number;
  spawnRate?: number;
  durationMs?: number;
  quantity?: number;
  totalRequests?: number;
  successCount?: number;
  failureCount?: number;
  avgLatencyMs?: number;
  p95LatencyMs?: number;
  remainingStock?: number;
  oversellDetected?: boolean;
  status?: string;
  metrics?: LoadTestMetricPoint[];
}

export interface GetAllHistoryResult {
  records: HistoryTestRecord[];
  status: 200 | 204;
}

const http = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

function extractTestId(payload: unknown): string | undefined {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload.trim();
  }
  if (typeof payload === "number" && Number.isFinite(payload)) {
    return String(payload);
  }
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;

  const candidates = [
    record.testId,
    record.testID,
    record.id,
    record.test_id,
    (record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>).testId ??
        (record.data as Record<string, unknown>).id
      : undefined),
  ];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return undefined;
}

function formatUrlFromConfig(config?: {
  baseURL?: string;
  url?: string;
  method?: string;
}): string {
  const method = (config?.method ?? "").toUpperCase();
  const base = config?.baseURL ?? "";
  const path = config?.url ?? "";
  const url = `${base}${path}`;
  return method ? `${method} ${url}` : url;
}

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const requestLabel = formatUrlFromConfig(error.config);

    if (!error.response) {
      return requestLabel
        ? `${requestLabel} failed: Network Error (server down, refused connection, or CORS blocked)`
        : "Network Error (server down, refused connection, or CORS blocked)";
    }

    const status = error.response.status;
    const statusText = error.response.statusText;
    const base = requestLabel ? `${requestLabel} failed` : "Request failed";
    return statusText ? `${base}: ${status} ${statusText}` : `${base}: ${status}`;
  }

  if (error instanceof Error) return error.message;
  return "Request failed";
}

export async function startLoadTestFlow(
  params: StartLoadTestParams,
  options?: { signal?: AbortSignal },
): Promise<StartLoadTestResponse> {
  await http.post(
    "/api/inventory/set/quantity",
    { quantity: params.quantity },
    { signal: options?.signal },
  );

  const response = await http.post<unknown>(
    "/load-test/start",
    {
      users: params.users,
      quantity: params.quantity,
      spawnRate: params.spawnRate,
      durationMs: params.durationMs,
    },
    { signal: options?.signal },
  );

  const testId = extractTestId(response.data);
  return { testId };
}

export async function getTestStatus(
  testId: string,
  options?: { signal?: AbortSignal },
): Promise<LoadTestStatusResponse> {
  const response = await http.get<unknown>(
    `/load-test/status/${encodeURIComponent(testId)}`,
    { signal: options?.signal },
  );

  const raw = (response.data ?? {}) as any;
  const normalized: LoadTestStatusResponse = {
    ...raw,
    testId: typeof raw?.testId === "string" ? raw.testId : testId,
    rps: normalizeTimeSeries(raw?.rps ?? raw?.rpsSeries ?? raw?.rpsOverTime),
    latencyMs: normalizeTimeSeries(
      raw?.latencyMs ?? raw?.latencySeries ?? raw?.latencyOverTime,
    ),
    metrics: normalizeMetrics(raw?.metrics ?? raw?.metricPoints ?? raw?.samples),
  };

  return normalized;
}

export async function getAllTestHistory(
  options?: { signal?: AbortSignal },
): Promise<GetAllHistoryResult> {
  const response = await http.get<unknown>("/load-test/get-all", {
    signal: options?.signal,
    validateStatus: () => true,
  });

  if (response.status === 204) {
    return { records: [], status: 204 };
  }

  if (response.status !== 200) {
    throw new Error("HISTORY_FETCH_STATUS_ERROR");
  }

  if (!Array.isArray(response.data)) return { records: [], status: 200 };

  const out: HistoryTestRecord[] = [];
  for (const item of response.data) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const testId = row.testId;
    if (typeof testId !== "string" || testId.trim().length === 0) continue;

    out.push({
      testId: testId.trim(),
      users: Number.isFinite(Number(row.users)) ? Number(row.users) : undefined,
      spawnRate: Number.isFinite(Number(row.spawnRate)) ? Number(row.spawnRate) : undefined,
      durationMs: Number.isFinite(Number(row.durationMs)) ? Number(row.durationMs) : undefined,
      quantity: Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : undefined,
      totalRequests: Number.isFinite(Number(row.totalRequests))
        ? Number(row.totalRequests)
        : undefined,
      successCount: Number.isFinite(Number(row.successCount))
        ? Number(row.successCount)
        : undefined,
      failureCount: Number.isFinite(Number(row.failureCount))
        ? Number(row.failureCount)
        : undefined,
      avgLatencyMs: Number.isFinite(Number(row.avgLatencyMs))
        ? Number(row.avgLatencyMs)
        : undefined,
      p95LatencyMs: Number.isFinite(Number(row.p95LatencyMs))
        ? Number(row.p95LatencyMs)
        : undefined,
      remainingStock: Number.isFinite(Number(row.remainingStock))
        ? Number(row.remainingStock)
        : undefined,
      oversellDetected:
        typeof row.oversellDetected === "boolean" ? row.oversellDetected : undefined,
      status: typeof row.status === "string" ? row.status : undefined,
      metrics: normalizeMetrics(row.metrics),
    });
  }

  return { records: out, status: 200 };
}

function normalizeMetrics(input: unknown): LoadTestMetricPoint[] {
  if (!Array.isArray(input)) return [];

  const out: LoadTestMetricPoint[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const timestamp = Number(r.timestamp ?? r.ts ?? r.time ?? r.t ?? r.x);
    const rps = Number(r.rps ?? r.reqPerSec ?? r.requestsPerSecond ?? r.v);
    const latency = Number(r.latency ?? r.latencyMs ?? r.p95LatencyMs ?? r.y);
    if (Number.isFinite(timestamp) && Number.isFinite(rps) && Number.isFinite(latency)) {
      out.push({ timestamp, rps, latency });
    }
  }

  out.sort((a, b) => a.timestamp - b.timestamp);
  return out;
}

export function isTerminalStatus(status?: string, completed?: boolean): boolean {
  if (completed === true) return true;
  const normalized = (status ?? "").toUpperCase();
  return [
    "COMPLETED",
    "FINISHED",
    "DONE",
    "PASSED",
    "SUCCEEDED",
    "SUCCESS",
    "FAILED",
    "ERROR",
    "CANCELLED",
  ].includes(
    normalized,
  );
}

function normalizeTimeSeries(input: unknown): TimeSeriesPoint[] {
  if (!Array.isArray(input)) return [];

  const out: TimeSeriesPoint[] = [];
  for (const item of input) {
    if (!item) continue;

    if (Array.isArray(item) && item.length >= 2) {
      const t = Number(item[0]);
      const v = Number(item[1]);
      if (Number.isFinite(t) && Number.isFinite(v)) out.push({ t, v });
      continue;
    }

    if (typeof item === "object") {
      const r = item as Record<string, unknown>;
      const t = Number(r.t ?? r.time ?? r.timestamp ?? r.ts ?? r.x);
      const v = Number(r.v ?? r.value ?? r.val ?? r.y);
      if (Number.isFinite(t) && Number.isFinite(v)) out.push({ t, v });
      continue;
    }
  }

  return out;
}
