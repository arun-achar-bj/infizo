import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Job } from "./types";
import { SheetError, defaultSettings, isValidSheetUrl, pullRows, pushJob, type Settings } from "./lib/sheets";
import { isDemoJob, mergeRows } from "./lib/merge";

const JOBS_KEY = "shoplog.jobs.v1";
const SET_KEY = "shoplog.settings.v1";

const load = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};

export interface SyncResult { ok: number; failed: number; added: number; updated: number; removed: number; pullFailed: boolean; error?: string; sheetRows?: number; sheetTab?: string }

/** One-line summary of a sync, for toasts. */
export function describeSync(r: SyncResult) {
  const parts: string[] = [];
  if (r.ok) parts.push(`${r.ok} sent`);
  if (r.added) parts.push(`${r.added} new from Sheet`);
  if (r.updated) parts.push(`${r.updated} updated from Sheet`);
  if (r.removed) parts.push(`${r.removed} removed (deleted in Sheet)`);
  if (r.failed) parts.push(`${r.failed} failed to send`);
  if (r.pullFailed) return `Couldn't read the Sheet: ${r.error || "unknown error"}`;
  const where = r.sheetRows !== undefined ? ` — Sheet tab “${r.sheetTab}” has ${r.sheetRows} ticket${r.sheetRows === 1 ? "" : "s"}` : "";
  return (parts.length ? `Synced: ${parts.join(", ")}` : "Everything is up to date") + where;
}

interface Ctx {
  jobs: Job[];
  settings: Settings;
  setSettings: (s: Settings) => void;
  nextTicket: () => string;
  saveJob: (j: Job) => Promise<{ status: "synced" | "queued" | "failed"; id: string }>;
  syncAll: () => Promise<SyncResult>;
  clearAll: () => void;
  syncing: boolean;
  pending: number;
  toast: string;
  notify: (m: string, ms?: number) => void;
  lastSync: { at: number; text: string; ok: boolean } | null;
}
const StoreCtx = createContext<Ctx>(null!);
export const useStore = () => useContext(StoreCtx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<Job[]>(() => load<Job[]>(JOBS_KEY, []).filter((x) => !isDemoJob(x)));
  const [settings, setSettingsState] = useState<Settings>(() => ({ ...defaultSettings, ...load(SET_KEY, {}) }));
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<{ at: number; text: string; ok: boolean } | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number>(0);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const notify = useCallback((m: string, ms = 3200) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), ms);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(JOBS_KEY, JSON.stringify(jobs)); }
    catch { notify("Storage full — sync to Google Sheets to free up photo space"); }
  }, [jobs, notify]);

  const setSettings = (s: Settings) => {
    setSettingsState(s);
    try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  };

  const upsertLocal = (j: Job) =>
    setJobs((prev) => (prev.some((p) => p.id === j.id) ? prev.map((p) => (p.id === j.id ? j : p)) : [j, ...prev]));

  const nextTicket = () => {
    const max = jobsRef.current.reduce((m, j) => Math.max(m, parseInt(j.id.replace(/\D/g, "")) || 0), 1000);
    return `TKT-${max + 1}`;
  };

  /** old id → new id, for tickets renumbered after a collision with another device. */
  const syncingRef = useRef(false);
  const aliases = useRef<Record<string, string>>({});

  const commit = (old: Job, next: Job) => {
    if (old.id === next.id) { upsertLocal(next); return; }
    aliases.current[old.id] = next.id;
    setJobs((prev) => [next, ...prev.filter((p) => p.id !== old.id && p.id !== next.id)]);
    notify(`${old.id} was already used on another device — renumbered to ${next.id}`);
  };

  const push = async (j: Job): Promise<Job> => {
    let cur = j;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await pushJob(settingsRef.current.sheetUrl, settingsRef.current.sheetSecret, cur);
        return { ...cur, photoFrontUrl: r.photoFrontUrl || cur.photoFrontUrl, photoLabelUrl: r.photoLabelUrl || cur.photoLabelUrl, synced: true };
      } catch (e) {
        if (e instanceof SheetError && e.code === "conflict" && e.nextId) { cur = { ...cur, id: e.nextId }; continue; }
        throw e;
      }
    }
    throw new SheetError("Could not find a free ticket number", "conflict");
  };

  const canSync = () => isValidSheetUrl(settingsRef.current.sheetUrl) && !!settingsRef.current.sheetSecret;

  const saveJob: Ctx["saveJob"] = async (j) => {
    const id = aliases.current[j.id] ?? j.id;
    // the customer's device PIN is only needed while the laptop is in the shop
    const local = { ...j, id, synced: false, pin: j.status === "Delivered" ? "" : j.pin };
    upsertLocal(local);
    if (!canSync()) return { status: "queued", id };
    try {
      const done = await push(local);
      commit(local, done);
      return { status: "synced", id: done.id };
    } catch { return { status: "failed", id }; }
  };

  /** Pull rows from the Sheet (including ones typed there by hand) and merge them in. */
  const pull = async () => {
    const { rows, sheet } = await pullRows(settingsRef.current.sheetUrl, settingsRef.current.sheetSecret);
    await new Promise((r) => setTimeout(r, 30)); // let just-pushed tickets commit before comparing
    const m = mergeRows(jobsRef.current, rows);
    if (m.added || m.updated || m.removed) setJobs((prev) => mergeRows(prev, rows).jobs);
    return { added: m.added, updated: m.updated, removed: m.removed, sheetRows: rows.length, sheetTab: sheet };
  };

  const syncAll = async (): Promise<SyncResult> => {
    const none: SyncResult = { ok: 0, failed: 0, added: 0, updated: 0, removed: 0, pullFailed: false };
    if (!canSync()) { notify("Add a valid Google Sheet URL and secret in Settings first"); return none; }
    if (syncingRef.current) return none;
    syncingRef.current = true;
    setSyncing(true);
    const res = { ...none };
    try {
      for (const j of jobsRef.current.filter((x) => !x.synced)) {
        try { commit(j, await push(j)); res.ok++; } catch (e) { res.failed++; res.error = res.error || (e instanceof Error ? e.message : String(e)); }
      }
      try { Object.assign(res, await pull()); } catch (e) { res.pullFailed = true; res.error = e instanceof Error ? e.message : String(e); }
    } finally {
      syncingRef.current = false; // always release, whatever happened above
      setSyncing(false);
    }
    setLastSync({ at: Date.now(), text: describeSync(res) + (res.failed && !res.pullFailed ? ` (${res.error})` : ""), ok: !res.pullFailed && !res.failed });
    return res;
  };

  // sync once when the app opens, so rows typed into the Sheet show up without tapping anything
  useEffect(() => {
    if (!true || !canSync()) return;
    syncAll().then((r) => { if (r.ok || r.added || r.updated || r.removed || r.pullFailed) notify(describeSync(r), r.pullFailed ? 8000 : 3200); });
  }, []);

  const clearAll = () => setJobs([]);
  const pending = useMemo(() => jobs.filter((j) => !j.synced).length, [jobs]);

  return (
    <StoreCtx.Provider value={{ lastSync, jobs, settings, setSettings, nextTicket, saveJob, syncAll, clearAll, syncing, pending, toast, notify }}>
      {children}
    </StoreCtx.Provider>
  );
}
