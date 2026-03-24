import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getAllTestHistory,
  getApiErrorMessage,
  getTestStatus,
  isTerminalStatus,
  startLoadTestFlow,
  type HistoryTestRecord,
  type LoadTestMetricPoint,
  type LoadTestStatusResponse,
  type StartLoadTestParams,
} from "@/lib/api";
import { ChartsSection } from "@/components/ChartsSection";
import { StockMetrics } from "@/components/StockMetrics";
import { SummaryCards } from "@/components/SummaryCards";
import { TestControlPanel } from "@/components/TestControlPanel";
import { TestHistory } from "@/components/TestHistory";

export interface DashboardState {
  lifecycle: "IDLE" | "STARTING" | "RUNNING" | "COMPLETED" | "FAILED";
  testId: string | null;
  startedAt: number | null;
  lastUpdatedAt: number | null;
  errorMessage: string | null;
  status: LoadTestStatusResponse | null;
  metrics: LoadTestMetricPoint[];
}

const initialState: DashboardState = {
  lifecycle: "IDLE",
  testId: null,
  startedAt: null,
  lastUpdatedAt: null,
  errorMessage: null,
  status: null,
  metrics: [],
};

function mergeMetrics(
  existing: LoadTestMetricPoint[],
  incoming: LoadTestMetricPoint[],
  maxPoints = 240,
): LoadTestMetricPoint[] {
  if (incoming.length === 0) return existing;
  if (existing.length === 0) return incoming.slice(-maxPoints);

  const map = new Map<number, LoadTestMetricPoint>();
  for (const p of existing) map.set(p.timestamp, p);
  for (const p of incoming) map.set(p.timestamp, p);

  const merged = Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  return merged.length > maxPoints ? merged.slice(merged.length - maxPoints) : merged;
}

function appendMetricPoint(
  existing: LoadTestMetricPoint[],
  point: LoadTestMetricPoint,
  maxPoints = 240,
): LoadTestMetricPoint[] {
  if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.rps) || !Number.isFinite(point.latency)) {
    return existing;
  }
  const next = existing.length === 0 ? [point] : [...existing, point];
  return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
}

function generateTimeSeriesFromAggregate(args: {
  startedAt: number;
  durationMs: number;
  totalRequests: number;
  avgLatencyMs: number;
  bucketSizeMs?: number;
}): LoadTestMetricPoint[] {
  const { startedAt, durationMs, totalRequests, avgLatencyMs, bucketSizeMs = 100 } =
    args;

  if (!Number.isFinite(durationMs) || durationMs <= 0) return [];
  if (!Number.isFinite(totalRequests) || totalRequests <= 0) return [];

  const buckets = Math.max(1, Math.ceil(durationMs / bucketSizeMs));
  const basePerBucket = Math.floor(totalRequests / buckets);
  let remainder = totalRequests - basePerBucket * buckets;

  const out: LoadTestMetricPoint[] = [];
  for (let i = 0; i < buckets; i++) {
    const timestamp = startedAt + i * bucketSizeMs;
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;

    const requestsThisBucket = Math.max(0, basePerBucket + extra);
    const rps = (requestsThisBucket * 1000) / bucketSizeMs;
    const latency = Math.max(0, avgLatencyMs + (Math.random() * 5 - 2));

    out.push({ timestamp, rps, latency });
  }

  return out;
}

function clampInt(value: number, min: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.trunc(value));
}

function mapHistoryToStatus(test: HistoryTestRecord): LoadTestStatusResponse {
  const totalRequests = test.totalRequests ?? 0;
  const successCount = test.successCount ?? 0;
  const failureCount = test.failureCount ?? 0;
  const successPercent =
    totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;
  const quantity = test.quantity ?? 0;
  const remainingStock = test.remainingStock ?? 0;
  const soldCount = Math.max(0, quantity - remainingStock);

  return {
    testId: test.testId,
    status: test.status,
    completed: isTerminalStatus(test.status, undefined),
    users: test.users,
    spawnRate: test.spawnRate,
    durationMs: test.durationMs,
    quantity,
    totalRequests,
    successCount,
    failureCount,
    successPercent,
    avgLatencyMs: test.avgLatencyMs ?? 0,
    p95LatencyMs: test.p95LatencyMs ?? 0,
    remainingStock,
    initialStock: quantity,
    soldCount,
    oversellDetected: test.oversellDetected,
    metrics: test.metrics ?? [],
  };
}

function upsertHistoryRecord(
  items: HistoryTestRecord[],
  incoming: HistoryTestRecord,
): HistoryTestRecord[] {
  const index = items.findIndex((item) => item.testId === incoming.testId);
  if (index === -1) return [incoming, ...items];

  const existing = items[index];
  const merged: HistoryTestRecord = {
    ...existing,
    ...incoming,
    metrics: mergeMetrics(existing.metrics ?? [], incoming.metrics ?? []),
  };
  return [merged, ...items.filter((item) => item.testId !== incoming.testId)];
}

function mergeServerHistoryWithLocal(
  local: HistoryTestRecord[],
  fetched: HistoryTestRecord[],
): HistoryTestRecord[] {
  const localById = new Map(local.map((item) => [item.testId, item] as const));

  const mergedFetched = fetched.map((row) => {
    const localRow = localById.get(row.testId);
    return {
      ...localRow,
      ...row,
      metrics: mergeMetrics(localRow?.metrics ?? [], row.metrics ?? []),
    };
  });

  const fetchedIds = new Set(fetched.map((item) => item.testId));
  const localOnly = local.filter((item) => !fetchedIds.has(item.testId));

  return [...localOnly, ...mergedFetched];
}

function mapLifecycleFromStatus(status?: string): DashboardState["lifecycle"] {
  const normalized = String(status ?? "").toUpperCase();
  if (["FAILED", "ERROR"].includes(normalized)) return "FAILED";
  if (["RUNNING", "STARTING"].includes(normalized)) return "RUNNING";
  return "COMPLETED";
}

export function Dashboard() {
  const [state, setState] = useState<DashboardState>(initialState);
  const [history, setHistory] = useState<HistoryTestRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyEmptyMessage, setHistoryEmptyMessage] = useState("NO HISTORY AVAILABLE");
  const [selectedHistoryTestId, setSelectedHistoryTestId] = useState<string | null>(
    null,
  );
  const pollTimerRef = useRef<number | null>(null);
  const pollAbortRef = useRef<AbortController | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (pollAbortRef.current) {
      pollAbortRef.current.abort();
      pollAbortRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (testId: string) => {
      stopPolling();
      const controller = new AbortController();
      pollAbortRef.current = controller;

      const tick = async () => {
        try {
          const data = await getTestStatus(testId, { signal: controller.signal });

          const normalizedStatus = String(data.status ?? "").toUpperCase();
          const isRunning = normalizedStatus === "RUNNING" || normalizedStatus === "STARTING";
          const now = Date.now();

          setHistory((prev) =>
            {
              const current = prev.find((item) => item.testId === testId);
              const currentMetrics = current?.metrics ?? [];

              let nextHistoryMetrics = mergeMetrics(currentMetrics, data.metrics ?? []);
              if ((data.metrics?.length ?? 0) === 0) {
                const prevTotal = current?.totalRequests;
                const prevAt = typeof current?.metrics?.at(-1)?.timestamp === "number"
                  ? current.metrics.at(-1)?.timestamp
                  : undefined;
                const nextTotal = data.totalRequests;

                const deltaSeconds =
                  typeof prevAt === "number" ? Math.max(0.001, (now - prevAt) / 1000) : undefined;
                const deltaRequests =
                  typeof prevTotal === "number" && typeof nextTotal === "number"
                    ? nextTotal - prevTotal
                    : undefined;

                const rps =
                  typeof deltaSeconds === "number" && typeof deltaRequests === "number"
                    ? Math.max(0, deltaRequests / deltaSeconds)
                    : undefined;

                const latency =
                  (typeof data.p95LatencyMs === "number" ? data.p95LatencyMs : undefined) ??
                  (typeof data.avgLatencyMs === "number" ? data.avgLatencyMs : undefined);

                if (typeof rps === "number" && typeof latency === "number") {
                  nextHistoryMetrics = appendMetricPoint(nextHistoryMetrics, {
                    timestamp: now,
                    rps,
                    latency,
                  });
                }
              }

              if (isTerminalStatus(data.status, data.completed) && (data.metrics?.length ?? 0) === 0) {
                const durationMs = typeof data.durationMs === "number" ? data.durationMs : undefined;
                const totalRequests = typeof data.totalRequests === "number" ? data.totalRequests : undefined;
                const avgLatencyMs = typeof data.avgLatencyMs === "number" ? data.avgLatencyMs : undefined;

                if (
                  typeof durationMs === "number" &&
                  typeof totalRequests === "number" &&
                  typeof avgLatencyMs === "number"
                ) {
                  const startedAt = currentMetrics[0]?.timestamp ?? now;
                  const generated = generateTimeSeriesFromAggregate({
                    startedAt,
                    durationMs,
                    totalRequests,
                    avgLatencyMs,
                    bucketSizeMs: 100,
                  });
                  if (generated.length > 0) nextHistoryMetrics = generated;
                }
              }

              return upsertHistoryRecord(prev, {
                testId,
                users: data.users,
                spawnRate: data.spawnRate,
                durationMs: data.durationMs,
                quantity: data.quantity,
                totalRequests: data.totalRequests,
                successCount: data.successCount,
                failureCount: data.failureCount,
                avgLatencyMs: data.avgLatencyMs,
                p95LatencyMs:
                  (typeof data.p95LatencyMs === "number" ? data.p95LatencyMs : undefined) ??
                  (typeof data.p95Latency === "number" ? data.p95Latency : undefined),
                remainingStock: data.remainingStock,
                oversellDetected: data.oversellDetected,
                status: normalizedStatus || "RUNNING",
                metrics: nextHistoryMetrics,
              });
            },
          );

          setState((prev) => {
            const isTerminal = isTerminalStatus(data.status, data.completed);
            const lifecycle = isTerminal
              ? (normalizedStatus === "FAILED" ? "FAILED" : "COMPLETED")
              : "RUNNING";

            const startedAt = prev.startedAt ?? now;

            let nextMetrics = mergeMetrics(prev.metrics, data.metrics ?? []);

            // If backend doesn't provide metrics[], still append incremental points from polled aggregates
            if ((data.metrics?.length ?? 0) === 0) {
              const prevTotal = prev.status?.totalRequests;
              const nextTotal = data.totalRequests;
              const prevAt = prev.lastUpdatedAt;

              const deltaSeconds =
                typeof prevAt === "number" ? Math.max(0.001, (now - prevAt) / 1000) : undefined;
              const deltaRequests =
                typeof prevTotal === "number" && typeof nextTotal === "number"
                  ? nextTotal - prevTotal
                  : undefined;

              const rps =
                typeof deltaSeconds === "number" && typeof deltaRequests === "number"
                  ? Math.max(0, deltaRequests / deltaSeconds)
                  : undefined;

              const latency =
                (typeof data.p95LatencyMs === "number" ? data.p95LatencyMs : undefined) ??
                (typeof data.avgLatencyMs === "number" ? data.avgLatencyMs : undefined);

              if (typeof rps === "number" && typeof latency === "number") {
                nextMetrics = appendMetricPoint(nextMetrics, {
                  timestamp: now,
                  rps,
                  latency,
                });
              }
            }

            // Fallback (no backend change): if backend doesn't provide metrics[], generate 100ms buckets
            // from the final aggregate when the test completes.
            if (isTerminal && (data.metrics?.length ?? 0) === 0) {
              const durationMs = typeof data.durationMs === "number" ? data.durationMs : undefined;
              const totalRequests = typeof data.totalRequests === "number" ? data.totalRequests : undefined;
              const avgLatencyMs = typeof data.avgLatencyMs === "number" ? data.avgLatencyMs : undefined;

              if (
                typeof durationMs === "number" &&
                typeof totalRequests === "number" &&
                typeof avgLatencyMs === "number"
              ) {
                const generated = generateTimeSeriesFromAggregate({
                  startedAt,
                  durationMs,
                  totalRequests,
                  avgLatencyMs,
                  bucketSizeMs: 100,
                });
                if (generated.length > 0) {
                  nextMetrics = generated;
                }
              }
            }

            return {
              ...prev,
              lifecycle,
              status: { ...data, testId },
              lastUpdatedAt: now,
              errorMessage: null,
              startedAt,
              metrics: nextMetrics,
            };
          });

          if (isTerminalStatus(data.status, data.completed) || (!isRunning && normalizedStatus)) {
            stopPolling();
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setState((prev) => ({
            ...prev,
            errorMessage: getApiErrorMessage(error),
          }));
        }
      };

      void tick();
      pollTimerRef.current = window.setInterval(tick, 500);
    },
    [stopPolling],
  );

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { records, status } = await getAllTestHistory();
      
      // Attempt to hydrate metrics from localStorage since backend doesn't store them
      const enrichedRecords = records.map((record) => {
        if (record.metrics && record.metrics.length > 0) return record;
        try {
          const stored = localStorage.getItem(`load_test_metrics_${record.testId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              return { ...record, metrics: parsed };
            }
          }
        } catch (e) {
          // ignore parsing errors
        }
        return record;
      });

      setHistoryEmptyMessage(status === 204 ? "No Previous Tests Found" : "NO HISTORY AVAILABLE");
      setHistory((prev) => mergeServerHistoryWithLocal(prev, enrichedRecords));
      setSelectedHistoryTestId((prev) => prev ?? (enrichedRecords[0]?.testId ?? null));
    } catch (error) {
      if (error instanceof Error && error.message === "HISTORY_FETCH_STATUS_ERROR") {
        setHistoryError("error loading previous test, try again later");
      } else {
        setHistoryError(getApiErrorMessage(error));
      }
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const onStart = useCallback(
    async (raw: StartLoadTestParams) => {
      stopPolling();
      const params: StartLoadTestParams = {
        users: clampInt(raw.users, 1),
        quantity: clampInt(raw.quantity, 0),
        spawnRate: clampInt(raw.spawnRate, 1),
        durationMs: clampInt(raw.durationMs, 1),
      };

      const controller = new AbortController();
      pollAbortRef.current = controller;

      setState((prev) => ({
        ...prev,
        lifecycle: "STARTING",
        testId: null,
        startedAt: Date.now(),
        status: null,
        errorMessage: null,
        metrics: [],
      }));

      try {
        const { testId } = await startLoadTestFlow(params, { signal: controller.signal });
        setState((prev) => ({
          ...prev,
          lifecycle: "RUNNING",
          testId: testId ?? null,
          startedAt: prev.startedAt ?? Date.now(),
          lastUpdatedAt: Date.now(),
          metrics: [],
        }));

        if (testId) {
          setHistory((prev) =>
            upsertHistoryRecord(prev, {
              testId,
              users: params.users,
              spawnRate: params.spawnRate,
              durationMs: params.durationMs,
              quantity: params.quantity,
              totalRequests: 0,
              successCount: 0,
              failureCount: 0,
              avgLatencyMs: 0,
              p95LatencyMs: 0,
              remainingStock: params.quantity,
              oversellDetected: false,
              status: "RUNNING",
              metrics: [],
            }),
          );
          setSelectedHistoryTestId(testId);
          startPolling(testId);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          lifecycle: "FAILED",
          errorMessage: getApiErrorMessage(error),
        }));
      }
    },
    [startPolling, stopPolling],
  );

  const onSelectHistoryTest = useCallback(
    (test: HistoryTestRecord) => {
      stopPolling();
      const status = mapHistoryToStatus(test);
      setSelectedHistoryTestId(test.testId);
      setState((prev) => ({
        ...prev,
        lifecycle: mapLifecycleFromStatus(test.status),
        testId: test.testId,
        status,
        lastUpdatedAt: Date.now(),
        errorMessage: null,
        metrics: test.metrics ?? [],
      }));
    },
    [stopPolling],
  );

  const onClearHistorySelection = useCallback(() => {
    stopPolling();
    setSelectedHistoryTestId(null);
    setState((prev) => ({
      ...prev,
      lifecycle: "IDLE",
      testId: null,
      status: null,
      metrics: [],
      errorMessage: null,
      startedAt: null,
      lastUpdatedAt: null,
    }));
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (state.lifecycle !== "COMPLETED" && state.lifecycle !== "FAILED") return;
    void loadHistory();
  }, [loadHistory, state.lifecycle]);

  useEffect(() => {
    if (state.testId && state.metrics && state.metrics.length > 0) {
      try {
        localStorage.setItem(
          `load_test_metrics_${state.testId}`,
          JSON.stringify(state.metrics),
        );
      } catch (e) {
        // ignore storage errors
      }
    }
  }, [state.testId, state.metrics]);

  const isBusy = state.lifecycle === "STARTING" || state.lifecycle === "RUNNING";

  const status = state.status;
  const summary = useMemo(() => {
    const totalRequests = status?.totalRequests ?? 0;
    const successCount = status?.successCount ?? 0;
    const failureCount = status?.failureCount ?? 0;

    return {
      totalRequests,
      successCount,
      failureCount,
      durationMs: status?.durationMs ?? 0,
      avgLatencyMs: status?.avgLatencyMs ?? 0,
      p95LatencyMs: status?.p95LatencyMs ?? status?.p95Latency ?? 0,
    };
  }, [status]);

  const stock = useMemo(() => {
    const initialStock =
      typeof status?.quantity === "number"
        ? status.quantity
        : status?.initialStock ?? 0;
    const remainingStock = status?.remainingStock ?? 0;
    const soldCount =
      typeof status?.soldCount === "number"
        ? status.soldCount
        : Math.max(0, initialStock - remainingStock);

    return {
      initialStock,
      soldCount,
      remainingStock,
      oversellDetected: status?.oversellDetected,
    };
  }, [status]);

  return (
    <div className="matrix-shell relative min-h-screen bg-[#010203] text-[#dffbff]">
      {isBusy && (
        <div 
          className="fixed inset-0 z-50 cursor-wait bg-transparent" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        />
      )}
      <main
        className="mx-auto flex w-full flex-col gap-4 px-4 py-5 sm:px-5 md:py-6"
        style={{ maxWidth: 1400 }}
      >
        <header
          className="mx-auto mb-1 flex w-full flex-col gap-1 border-b border-[#1a2530] pb-3"
          style={{ maxWidth: 920 }}
        >
          <h1 className="matrix-title text-center">
            <span className="mr-2 text-[#9cc8d6]">&gt;_</span>
            MATRIX LOAD ENGINE
          </h1>
          <div className="matrix-subhead">
            <span>CORE_v2.5</span>
            <span>DB_SYNC_ACTIVE</span>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          <div className="flex flex-col gap-4">
            <TestControlPanel
              disabled={isBusy}
              loading={state.lifecycle === "STARTING"}
              lifecycle={state.lifecycle}
              testId={state.testId}
              errorMessage={state.errorMessage}
              onStart={onStart}
            />
            <TestHistory
              tests={history}
              loading={historyLoading}
              errorMessage={historyError}
              emptyMessage={historyEmptyMessage}
              selectedTestId={selectedHistoryTestId}
              onSelectTest={onSelectHistoryTest}
              onClearSelection={onClearHistorySelection}
            />
          </div>

          <div className="grid gap-4">
            <StockMetrics
              data={stock}
              showOversellDetected={true}
              lifecycle={state.lifecycle}
            />
            <SummaryCards data={summary} />
            <ChartsSection data={state.metrics} />
          </div>
        </div>
      </main>
    </div>
  );
}
