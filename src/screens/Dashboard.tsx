import { useMemo, useState } from "react";
import { JobCard, SearchBar, matches } from "../components";
import { dayClose, owing } from "../lib/desk";
import { inr } from "../lib/format";
import { useStore } from "../store";
import { Button, EmptyState, Icon } from "../ui";
import type { Status } from "../types";

const TILES: { key: string; label: string; icon: string; tone: string; statuses: Status[] }[] = [
  { key: "diag", label: "In Diagnosis", icon: "troubleshoot", tone: "border-accent text-primary", statuses: ["Received", "Diagnosing", "Repaired & Testing"] },
  { key: "parts", label: "Waiting on Parts", icon: "hourglass_top", tone: "border-amber text-amber", statuses: ["Spare Parts Pending"] },
  { key: "ready", label: "Ready for Delivery", icon: "check_circle", tone: "border-tertiary text-tertiary", statuses: ["Ready for Delivery"] },
  { key: "done", label: "Delivered", icon: "inventory_2", tone: "border-outline text-on-surface-variant", statuses: ["Delivered"] },
];

export default function Dashboard({ go }: { go: (p: string) => void }) {
  const { jobs, settings } = useStore();
  const [q, setQ] = useState("");
  const [tile, setTile] = useState<string>("all");
  const connected = !!(settings.sheetUrl && settings.sheetSecret);

  const count = (st: Status[]) => jobs.filter((j) => st.includes(j.status)).length;
  const dueRows = owing(jobs);
  const dueTotal = dueRows.reduce((s, x) => s + x.due, 0);
  const today = dayClose(jobs);
  const active = jobs.filter((j) => j.status !== "Delivered");
  const list = useMemo(() => {
    const t = TILES.find((x) => x.key === tile);
    return active
      .filter((j) => !t || t.statuses.includes(j.status))
      .filter((j) => matches(j, q))
      .sort((a, b) => +new Date(b.dateIn) - +new Date(a.dateIn));
  }, [jobs, q, tile]);

  return (
    <div className="px-margin py-space-xl flex flex-col gap-space-lg">
      <div>
        <div className="font-label text-label-md text-white/70 mb-1">{settings.shopName || "Shop"}</div>
        <h1 className="font-headline text-headline-xl-mobile text-white">How’s the bench today?</h1>
        <div className="font-body text-body-md text-white/70 mt-2">
          {active.length} open {active.length === 1 ? "repair" : "repairs"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TILES.map((t) => {
          const sel = tile === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTile(sel ? "all" : t.key)}
              className={`text-left p-4 rounded-xl glass transition-colors duration-100 ${sel ? "ring-2 ring-white/70" : ""}`}
            >
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center bg-white/10 ${t.tone.split(" ").find((x) => x.startsWith("text-")) || "text-primary"}`}>
                <Icon name={t.icon} />
              </span>
              <div className="font-headline text-[28px] leading-8 text-white mt-3">{count(t.statuses)}</div>
              <div className="font-label text-label-md text-white/70 mt-1">{t.label}</div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => go("/dues")} className="text-left p-4 rounded-xl glass">
          <div className="font-label text-label-sm text-white/70">Outstanding</div>
          <div className="font-headline text-headline-md text-white mt-1">{inr(dueTotal)}</div>
          <div className="font-label text-label-sm text-white/60 mt-1">{dueRows.length} open</div>
        </button>
        <button type="button" onClick={() => go("/close")} className="text-left p-4 rounded-xl glass">
          <div className="font-label text-label-sm text-white/70">Today</div>
          <div className="font-headline text-headline-md text-white mt-1">{today.takenIn.length} in · {today.delivered.length} out</div>
          <div className="font-label text-label-sm text-white/60 mt-1">{inr(today.collected)} collected</div>
        </button>
      </div>

      <SearchBar value={q} onChange={setQ} />

      <div className="flex flex-col gap-3">
        {list.map((j) => <JobCard key={j.id} job={j} onOpen={() => go(`/job/${j.id}`)} />)}
        {list.length === 0 && jobs.length === 0 && !connected ? (
          <div className="flex flex-col gap-space-md">
            <EmptyState icon="table_view" title="Connect your Google Sheet" sub="Your repair tickets live in the Sheet. Add its URL and secret in Settings and they'll load here." />
            <Button icon="settings" onClick={() => go("/settings")}>Open Settings</Button>
          </div>
        ) : list.length === 0 && (
          <EmptyState icon="build_circle" title={q || tile !== "all" ? "No matching jobs" : "No active repairs"} sub={q || tile !== "all" ? "Try clearing the search or filter." : "Tap the sync button to refresh from the Sheet, or New Intake to log a laptop."} />
        )}
      </div>
    </div>
  );
}
