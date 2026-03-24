import type { HistoryTestRecord } from "@/lib/api";

export interface TestHistoryProps {
  tests: HistoryTestRecord[];
  loading: boolean;
  errorMessage: string | null;
  emptyMessage?: string;
  selectedTestId: string | null;
  onSelectTest: (test: HistoryTestRecord) => void;
  onClearSelection: () => void;
}

function testSuffix(testId: string): string {
  const normalized = testId.replace(/-/g, "");
  return normalized.slice(-4).toUpperCase();
}

function statusTone(status?: string): string {
  const normalized = String(status ?? "").toUpperCase();
  if (normalized === "FAILED" || normalized === "ERROR") return "text-[#ff9f9f]";
  if (normalized === "PASSED" || normalized === "COMPLETED" || normalized === "SUCCESS") {
    return "text-[#abffce]";
  }
  return "text-[#90a4b2]";
}

export function TestHistory({
  tests,
  loading,
  errorMessage,
  emptyMessage,
  selectedTestId,
  onSelectTest,
  onClearSelection,
}: TestHistoryProps) {
  return (
    <section className="matrix-panel" style={{ minHeight: 168 }}>
      <header className="matrix-panel-header flex items-center justify-between gap-3">
        <h2 className="matrix-panel-title">
          <span className="text-[#7f8d99]">o</span> TEST HISTORY
        </h2>
        <button
          type="button"
          onClick={onClearSelection}
          className="grid h-5 w-5 place-items-center border border-[#334655] text-[10px] leading-none text-[#d6f7ff] transition-colors hover:bg-[#123043]"
          aria-label="Clear selected test matrix"
          title="Clear selected test matrix"
        >
          X
        </button>
      </header>
      {loading ? (
        <div className="flex min-h-20 items-center justify-center p-5 sm:min-h-28">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[#8ca3b1]">LOADING...</span>
        </div>
      ) : errorMessage ? (
        <div className="p-4">
          <div className="rounded-none border border-[#6a1a1a] bg-[#2c0c0c] px-3 py-2 text-[11px] tracking-[0.08em] text-[#ff9f9f]">
            {errorMessage}
          </div>
        </div>
      ) : tests.length === 0 ? (
        <div className="flex min-h-20 items-center justify-center p-5 sm:min-h-28">
          <span className="font-mono text-[10px] tracking-[0.16em] text-[#5f6d79]">
            {emptyMessage ?? "NO HISTORY AVAILABLE"}
          </span>
        </div>
      ) : (
        <ul className="divide-y divide-[#1f2a34] overflow-auto" style={{ maxHeight: 270 }}>
          {tests.map((test) => {
            const selected = selectedTestId === test.testId;
            return (
              <li key={test.testId}>
                <button
                  type="button"
                  onClick={() => onSelectTest(test)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-[#0b1218]"
                  style={{ background: selected ? "#0f1a23" : "transparent" }}
                >
                  <span className="font-mono text-xs tracking-[0.16em] text-[#d9f6ff]">
                    TEST_{testSuffix(test.testId)}
                  </span>
                  <span className={`font-mono text-[10px] tracking-[0.12em] ${statusTone(test.status)}`}>
                    {String(test.status ?? "UNKNOWN").toUpperCase()}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
