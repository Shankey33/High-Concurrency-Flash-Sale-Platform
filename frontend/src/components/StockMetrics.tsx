import type { LoadTestLifecycleStatus } from "@/lib/api";

export interface StockData {
  initialStock: number;
  soldCount: number;
  remainingStock: number;
  oversellDetected?: boolean;
}

function MetricIcon({ kind }: { kind: "crate" | "cart" | "package" }) {
  if (kind === "crate") {
    return (
      <svg viewBox="0 0 24 24" className="h-9 w-9 text-[#2a3743]" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="m12 2 8 4.5v11L12 22l-8-4.5v-11L12 2Z" />
        <path d="M12 22V11.5" />
        <path d="m20 6.5-8 5-8-5" />
      </svg>
    );
  }
  if (kind === "cart") {
    return (
      <svg viewBox="0 0 24 24" className="h-9 w-9 text-[#2a3743]" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
        <path d="M2 3h3l2.8 10.5a2 2 0 0 0 2 1.5h7.6a2 2 0 0 0 1.9-1.4L22 7H7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-9 w-9 text-[#2a3743]" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 7.5h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10Z" />
      <path d="M3 7.5h18" />
      <path d="M8 7.5V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2.5" />
    </svg>
  );
}

export function StockMetrics({
  data,
  showOversellDetected,
  lifecycle,
}: {
  data: StockData;
  showOversellDetected: boolean;
  lifecycle?: LoadTestLifecycleStatus;
}) {
  const overselling = data.oversellDetected ?? data.soldCount > data.initialStock;
  const isFinished = lifecycle === "COMPLETED" || lifecycle === "FAILED";

  const cards: Array<{
    label: string;
    value: string;
    icon: "crate" | "cart" | "package";
    valueClassName: string;
    centered?: boolean;
    panelClassName?: string;
  }> = [
    {
      label: "INITIAL STOCK",
      value: String(data.initialStock),
      icon: "crate" as const,
      valueClassName: "matrix-stat-value",
    },
    {
      label: "SOLD COUNT",
      value: isFinished ? String(data.soldCount) : "--",
      icon: "cart" as const,
      valueClassName: "matrix-stat-value",
    },
  ];

  if (showOversellDetected) {
    // Only reveal the result when the test is finished.
    const showYes = isFinished && overselling;
    const showNo = isFinished && !overselling;

    const valueText = showYes ? "YES" : (showNo ? "NO" : "");

    cards.push({
      label: "OVER SELL DETECTED",
      value: valueText,
      icon: "package" as const,
      valueClassName: showYes ? "text-[#ff9fad]" : "text-[#9bffbf]",
      centered: true,
      panelClassName: showYes
        ? "border-[#70313c] bg-[linear-gradient(180deg,#12080b_0%,#080405_100%)]"
        : undefined,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {cards.map((card) => (
        <article
          key={card.label}
          className={`matrix-panel ${card.panelClassName ?? ""}`}
          style={{ minHeight: 126 }}
        >
          {card.centered ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center">
              <p className={`text-4xl font-bold mb-2 ${card.valueClassName}`}>
                {card.value}
              </p>
              <p
                className={`matrix-stat-label ${
                  overselling ? "text-[#ff9fad]" : "text-[#9bffbf]"
                }`}
              >
                {card.label}
              </p>
            </div>
          ) : (
            <div className="flex items-start justify-between p-4">
              <div>
                <p className="matrix-stat-label">{card.label}</p>
                <p className={card.valueClassName}>{card.value}</p>
              </div>
              <MetricIcon kind={card.icon} />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
