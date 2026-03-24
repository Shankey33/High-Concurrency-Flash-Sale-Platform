import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type { StartLoadTestParams } from "@/lib/api";

export interface TestControlPanelProps {
  disabled: boolean;
  loading: boolean;
  lifecycle: "IDLE" | "STARTING" | "RUNNING" | "COMPLETED" | "FAILED";
  testId: string | null;
  errorMessage: string | null;
  onStart: (params: StartLoadTestParams) => void | Promise<void>;
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function TestControlPanel({
  disabled,
  loading,
  lifecycle,
  testId,
  errorMessage,
  onStart,
}: TestControlPanelProps) {
  const [users, setUsers] = useState("");
  const [quantity, setQuantity] = useState("");
  const [spawnRate, setSpawnRate] = useState("");
  const [durationMs, setDurationMs] = useState("");

  const payload = useMemo<StartLoadTestParams>(
    () => ({
      users: toNumber(users),
      quantity: toNumber(quantity),
      spawnRate: toNumber(spawnRate),
      durationMs: toNumber(durationMs),
    }),
    [durationMs, quantity, spawnRate, users],
  );

  const handleStart = useCallback(() => {
    onStart(payload);
  }, [onStart, payload]);

  useEffect(() => {
    if (lifecycle !== "COMPLETED") return;
    setUsers("");
    setQuantity("");
    setSpawnRate("");
    setDurationMs("");
  }, [lifecycle]);

  const fieldClassName =
    "h-11 rounded-none border border-[#28313a] bg-[#0a0f14] text-[#f5fdff] font-mono text-2xl tracking-wide focus-visible:ring-1 focus-visible:ring-[#b8f3ff]";

  return (
    <section className="matrix-panel">
      <header className="matrix-panel-header">
        <h2 className="matrix-panel-title">
          <span className="text-[#7f8d99]">[]</span> CONFIG_PARAMS
        </h2>
      </header>

      <div className="grid gap-4 p-4">
        <div className="grid grid-cols-1 gap-3">
          <label className="matrix-field-label">
            <span>VIRTUAL USERS</span>
            <Input
              type="number"
              inputMode="numeric"
              value={users}
              onChange={(e) => setUsers(e.currentTarget.value)}
              className={fieldClassName}
            />
          </label>
          <label className="matrix-field-label">
            <span>INVENTORY QTY</span>
            <Input
              type="number"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.currentTarget.value)}
              className={fieldClassName}
            />
          </label>
          <label className="matrix-field-label">
            <span>SPAWN RATE</span>
            <Input
              type="number"
              inputMode="numeric"
              value={spawnRate}
              onChange={(e) => setSpawnRate(e.currentTarget.value)}
              className={fieldClassName}
            />
          </label>
          <label className="matrix-field-label">
            <span>DURATION (MS)</span>
            <Input
              type="number"
              inputMode="numeric"
              value={durationMs}
              onChange={(e) => setDurationMs(e.currentTarget.value)}
              className={fieldClassName}
            />
          </label>
        </div>

        <div className="grid gap-2 pt-1">
          <Button
            disabled={disabled || loading}
            onClick={handleStart}
            className="h-12 rounded-none border border-[#d2f7ff] bg-[#f4fbff] text-[#05080d] font-mono text-xs tracking-[0.22em] shadow-[0_0_18px_rgba(206,248,255,0.45)] hover:bg-white"
          >
            <span className="mr-1 text-sm">&gt;</span>
            {loading
              ? "STARTING..."
              : lifecycle === "RUNNING"
                ? "TEST RUNNING !"
                : "START_SEQUENCE"}
          </Button>

          <div className="min-h-4 text-[10px] tracking-[0.12em] text-[#6f7f8d]">
            {testId ? <span>SESSION: {testId}</span> : null}
          </div>
        </div>

        {errorMessage ? (
          <div className="rounded-none border border-[#6a1a1a] bg-[#2c0c0c] px-3 py-2 text-[11px] tracking-[0.08em] text-[#ff9f9f]">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
}
