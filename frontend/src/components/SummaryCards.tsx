export interface SummaryData {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  durationMs: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 ms";
  return `${Math.round(value)} ms`;
}

function MiniIcon({ kind }: { kind: "requests" | "success" | "failure" | "rate" | "avg" | "max" }) {
  const base = "h-4 w-4 text-[#6e7d89]";
  if (kind === "requests") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 12h4l2-5 4 10 2-5h4" />
      </svg>
    );
  }
  if (kind === "success") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="m9.5 12.5 1.7 1.8 3.5-3.8" />
      </svg>
    );
  }
  if (kind === "failure") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="m9.5 9.5 5 5m0-5-5 5" />
      </svg>
    );
  }
  if (kind === "rate") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M13 3 6 14h5l-1 7 7-11h-5z" />
      </svg>
    );
  }
  if (kind === "avg") {
    return (
      <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v4l2.5 1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={base} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M5 15 9 11l3 3 7-7" />
      <path d="M15 7h4v4" />
    </svg>
  );
}

export function SummaryCards({ data }: { data: SummaryData }) {
  const items: Array<{ label: string; value: string; icon: "requests" | "success" | "failure" | "rate" | "avg" | "max" }> = [
    { label: "TOTAL REQUESTS", value: String(data.totalRequests), icon: "requests" },
    { label: "SUCCESS COUNT", value: String(data.successCount), icon: "success" },
    { label: "FAILURE COUNT", value: String(data.failureCount), icon: "failure" },
    { label: "DURATION", value: formatDuration(data.durationMs), icon: "rate" },
    { label: "AVG LATENCY", value: `${Math.round(data.avgLatencyMs)} ms`, icon: "avg" },
    { label: "P95 LATENCY", value: `${Math.round(data.p95LatencyMs)} ms`, icon: "max" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <article key={item.label} className="matrix-panel px-3 py-3" style={{ minHeight: 92 }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="matrix-stat-label text-[10px]">{item.label}</p>
            <MiniIcon kind={item.icon} />
          </div>
          <div className="matrix-stat-value text-4xl sm:text-3xl">{item.value}</div>
        </article>
      ))}
    </div>
  );
}
