import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LoadTestMetricPoint } from "@/lib/api";

function formatTime(value: number): string {
  const d = new Date(value);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function ChartsSection({
  data,
}: {
  data: LoadTestMetricPoint[];
}) {
  const chartData = data
    .filter(
      (p) =>
        Number.isFinite(p.timestamp) &&
        Number.isFinite(p.rps) &&
        Number.isFinite(p.latency),
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const hasData = chartData.length > 1;

  const panelClassName =
    "matrix-panel overflow-hidden before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(to_bottom,transparent_0%,rgba(180,245,255,0.03)_50%,transparent_100%)] before:content-['']";

  const headerClassName = "matrix-panel-header relative z-10";

  const emptyGrid = (
    <div className="relative h-full w-full bg-[#03070b]">
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,transparent_0,transparent_98%,rgba(140,190,215,0.08)_100%),linear-gradient(to_bottom,transparent_0,transparent_98%,rgba(140,190,215,0.09)_100%)]"
        style={{ backgroundSize: "120px 100%, 100% 120px" }}
      />
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className={panelClassName}>
        <header className={headerClassName}>
          <h2 className="matrix-panel-title">RPS_DYNAMICS</h2>
        </header>
        <div className="relative z-10 p-2" style={{ height: 274 }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: 8, right: 14, top: 8, bottom: 8 }}>
                <CartesianGrid stroke="rgba(137,191,214,0.14)" strokeDasharray="2 6" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  minTickGap={30}
                  domain={["dataMin", "dataMax"]}
                  type="number"
                  tick={{ fill: "#7f99a7", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(137,191,214,0.2)" }}
                  tickLine={{ stroke: "rgba(137,191,214,0.2)" }}
                />
                <YAxis
                  tick={{ fill: "#7f99a7", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(137,191,214,0.2)" }}
                  tickLine={{ stroke: "rgba(137,191,214,0.2)" }}
                />
                <Tooltip
                  labelFormatter={(v) => formatTime(Number(v))}
                  contentStyle={{
                    background: "#081018",
                    border: "1px solid rgba(162,226,245,0.45)",
                    borderRadius: 0,
                    color: "#d2f7ff",
                    fontSize: "11px",
                  }}
                />
                <Line type="monotone" dataKey="rps" stroke="#d7fbff" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            emptyGrid
          )}
        </div>
      </section>

      <section className={panelClassName}>
        <header className={headerClassName}>
          <h2 className="matrix-panel-title">LATENCY_PROFILE_MS</h2>
        </header>
        <div className="relative z-10 p-2" style={{ height: 274 }}>
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ left: 8, right: 14, top: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="rgba(137,191,214,0.14)" strokeDasharray="2 6" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  minTickGap={30}
                  domain={["dataMin", "dataMax"]}
                  type="number"
                  tick={{ fill: "#7f99a7", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(137,191,214,0.2)" }}
                  tickLine={{ stroke: "rgba(137,191,214,0.2)" }}
                />
                <YAxis
                  tick={{ fill: "#7f99a7", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(137,191,214,0.2)" }}
                  tickLine={{ stroke: "rgba(137,191,214,0.2)" }}
                />
                <Tooltip
                  labelFormatter={(v) => formatTime(Number(v))}
                  contentStyle={{
                    background: "#081018",
                    border: "1px solid rgba(162,226,245,0.45)",
                    borderRadius: 0,
                    color: "#d2f7ff",
                    fontSize: "11px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="#9ee9ff"
                  strokeWidth={2.2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            emptyGrid
          )}
        </div>
      </section>
    </div>
  );
}
