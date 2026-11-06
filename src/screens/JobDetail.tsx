import { useEffect, useState } from "react";
import { useDictation, whatsappStatus } from "../components";
import { digits, fmtDelivery, fmtTime, inr } from "../lib/format";
import { useStore } from "../store";
import { Button, Card, CardTitle, Field, Icon, IconButton, IconLink, Label, ScreenHeader, StatusPill, Thumb, EmptyState } from "../ui";
import { STATUSES, finalBill, type Job, type Payment, type Status } from "../types";

const STEP_LABEL: Record<Status, string> = {
  Received: "Received", Diagnosing: "Diagnosing", "Spare Parts Pending": "Parts Pending",
  "Repaired & Testing": "Repaired & Testing", "Ready for Delivery": "Ready", Delivered: "Delivered",
};

export default function JobDetail({ id, go }: { id: string; go: (p: string) => void }) {
  const { jobs, saveJob, settings, notify } = useStore();
  const stored = jobs.find((j) => j.id === id);
  const [job, setJob] = useState<Job | undefined>(stored);
  const [entry, setEntry] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState("");
  const [showPin, setShowPin] = useState(false);
  useEffect(() => { if (!job && stored) setJob(stored); }, [stored]);

  const dict = useDictation((t) => setEntry((p) => (p ? p + " " : "") + t));

  if (!job) return (<><ScreenHeader title="Ticket" onBack={() => go("/")} /><EmptyState icon="error" title="Ticket not found" /></>);

  const patch = (p: Partial<Job>) => setJob((j) => ({ ...j!, ...p }));
  const dirty = JSON.stringify(job) !== JSON.stringify(stored);
  const bill = finalBill(job);
  const stage = STATUSES.indexOf(job.status);
  const locked = job.status === "Delivered";

  const setStatus = (s: Status) => {
    if (locked) return;
    if (s === "Delivered") { go(`/handover/${job.id}`); return; }
    const p: Partial<Job> = { status: s };
    if (s === "Ready for Delivery" || s === "Repaired & Testing") p.dateRepaired = job.dateRepaired || new Date().toISOString();
    patch(p);
  };

  const addEntry = () => {
    const text = entry.trim();
    if (!text) return;
    patch({ workLog: [...job.workLog, { at: new Date().toISOString(), text }] });
    setEntry("");
  };

  const sync = async () => {
    setBusy(true);
    const pending = entry.trim() ? { ...job, workLog: [...job.workLog, { at: new Date().toISOString(), text: entry.trim() }] } : job;
    const { status: r, id: savedId } = await saveJob(pending);
    setJob(pending);
    setEntry("");
    setBusy(false);
    if (savedId !== job.id) go(`/job/${savedId}`);
    notify(r === "synced" ? "Status updated & Sheet synced" : r === "queued" ? "Saved on device — add a Sheet URL in Settings to sync" : "Saved — Sheet sync failed, will retry");
  };

  const pay = (p: Payment) => patch({ payment: p, advance: p === "Partial Advance" ? job.advance || Math.round((bill || job.estimate) / 2) : 0 });
  const num = (v: string) => Number(v.replace(/\D/g, "")) || 0;

  return (
    <div className="pb-48">
      <ScreenHeader
        onBack={() => go(job.status === "Delivered" ? "/done" : "/")}
        title={<span className="font-label text-body-lg font-bold">#{job.id}</span>}
        sub={`Intake: ${job.model}`}
        right={<><StatusPill status={job.status} /><IconLink icon="call" label="Call customer" tone="green" href={`tel:${digits(job.phone)}`} /></>}
      />

      <div className="px-margin py-space-lg flex flex-col gap-space-lg">
        <Card>
          <CardTitle icon="photo_camera" hint={`${[job.photoFront, job.photoLabel].filter(Boolean).length} assets attached`} hintClass="text-on-surface-variant">Intake inspection</CardTitle>
          <div className="grid grid-cols-2 gap-space-sm">
            {[{ s: job.photoFront, l: "Front / chassis" }, { s: job.photoLabel, l: "Condition / label" }].map((p) => (
              <button key={p.l} onClick={() => p.s && setZoom(p.s)} className="relative h-32 text-left">
                <Thumb src={p.s} className="w-full h-full" />
                <span className="absolute bottom-1 left-1 px-1.5 rounded bg-surface-dim/80 font-label text-label-sm">{p.l}</span>
              </button>
            ))}
          </div>
          {job.serial && <div className="mt-space-sm font-label text-label-md text-tertiary">SN: {job.serial}</div>}
          {(job.damage.length > 0 || job.conditionNote) && (
            <div className="mt-space-sm flex flex-wrap gap-1">
              {[...job.damage, job.conditionNote].filter(Boolean).map((d) => (
                <span key={d} className="px-2 h-6 inline-flex items-center rounded-lg border border-error text-error font-label text-label-sm">{d}</span>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-xl bg-secondary-container/40 border border-accent-edge text-on-secondary-container font-headline font-bold text-body-lg flex items-center justify-center shrink-0">
              {job.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-headline text-headline-md truncate">{job.name}</div>
              <div className="font-label text-label-md text-on-surface-variant">{job.phone}</div>
            </div>
            <IconLink icon="chat" label="WhatsApp" tone="green" href={whatsappStatus(job, settings.shopName)} />
          </div>
          {job.issue && <p className="mt-space-md text-body-md text-on-surface-variant border-t border-outline-variant pt-space-md">“{job.issue}”</p>}
          {job.pin && !locked && (
            <button onClick={() => setShowPin(!showPin)} className="mt-space-sm w-full h-10 px-space-md rounded-lg border border-outline-variant bg-surface-container-lowest flex items-center gap-space-sm">
              <Icon name="lock" className="text-outline" />
              <span className="font-label text-label-sm text-on-surface-variant uppercase">Device PIN</span>
              <span className="flex-1 text-right font-label text-label-lg">{showPin ? job.pin : "••••••"}</span>
              <Icon name={showPin ? "visibility_off" : "visibility"} className="text-outline" />
            </button>
          )}
          <div className="mt-space-sm font-label text-label-md text-primary flex items-center gap-1"><Icon name="local_shipping" className="!text-[16px]" />Due: {fmtDelivery(job.expectedDelivery)}</div>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-space-sm">
            <Label>Status lifecycle</Label>
            <span className="font-label text-label-md text-primary">Stage {stage + 1} of 6</span>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-margin px-margin pb-1">
            {STATUSES.map((s, i) => {
              const cur = i === stage, past = i < stage;
              return (
                <div key={s} className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setStatus(s)}
                    disabled={locked}
                    className={`h-11 px-space-md rounded-lg border flex items-center gap-1.5 font-label text-label-md transition-colors duration-100 ${
                      cur ? "bg-primary-container border-accent text-on-primary-container"
                      : past ? "bg-tertiary-container/15 border-tertiary text-tertiary"
                      : "bg-surface-container border-outline-variant text-on-surface-variant"
                    }`}
                  >
                    <Icon name={past ? "check_circle" : cur ? "sync" : "radio_button_unchecked"} className="!text-[16px]" />
                    {i + 1}. {STEP_LABEL[s]}
                  </button>
                  {i < 5 && <Icon name="chevron_right" className="text-outline !text-[16px]" />}
                </div>
              );
            })}
          </div>
        </div>

        <Card>
          <div className="flex items-center gap-space-md pb-space-md border-b border-outline-variant">
            <Icon name="engineering" className="text-primary" />
            <div className="flex-1 min-w-0">
              <div className="font-label text-label-sm text-on-surface-variant uppercase">Assigned tech</div>
              <input value={job.tech} onChange={(e) => patch({ tech: e.target.value })} className="w-full bg-transparent font-headline text-body-lg font-semibold" placeholder="Technician name" />
            </div>
            <button onClick={dict.toggle} className={`h-11 px-space-md rounded-lg border flex items-center gap-1 font-label text-label-md ${dict.listening ? "bg-error-container/30 border-error text-error" : "border-outline-variant text-on-surface-variant"}`}>
              <Icon name={dict.listening ? "stop" : "mic"} className="!text-[18px]" />{dict.listening ? "Stop" : "Dictate"}
            </button>
          </div>
          <div className="mt-space-md font-label text-label-sm text-on-surface-variant uppercase mb-space-sm">Service log entries</div>
          <div className="flex flex-col gap-space-sm">
            {job.workLog.map((w, i) => (
              <div key={i} className="p-space-md bg-surface-container-lowest border border-outline-variant rounded-lg">
                <div className="flex items-center gap-1 font-label text-label-md text-primary"><Icon name="schedule" className="!text-[14px]" />{fmtTime(w.at)}</div>
                <p className="text-body-md mt-1">{w.text}</p>
              </div>
            ))}
            {job.workLog.length === 0 && <p className="text-body-sm text-on-surface-variant">No work logged yet.</p>}
          </div>
          <div className="mt-space-md relative">
            <textarea
              value={entry + (dict.interim ? " " + dict.interim : "")}
              onChange={(e) => setEntry(e.target.value)}
              rows={3}
              disabled={locked}
              placeholder="Add work done — e.g. Replaced SSD, fresh OS, thermal paste reapplied"
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-space-md pr-14 text-body-md resize-none focus:border-accent"
            />
            <button onClick={addEntry} aria-label="Add entry" className="absolute right-2 bottom-3 w-10 h-10 rounded-lg bg-primary-container border border-accent-edge text-on-primary-container flex items-center justify-center active:scale-95"><Icon name="send" /></button>
          </div>
        </Card>

        <Card>
          <CardTitle icon="receipt_long" hint={job.synced ? "Synced" : "Not synced"} hintClass={job.synced ? "text-tertiary" : "text-amber"}>Billing &amp; payment</CardTitle>
          <div className="flex flex-col gap-space-md">
            <Field label="Parts cost" icon="memory" mono inputMode="numeric" value={job.partsCost ? String(job.partsCost) : ""} placeholder="0" onChange={(e) => patch({ partsCost: num(e.target.value) })} disabled={locked} />
            <Field label="Labor & diagnostic fee" icon="build" mono inputMode="numeric" value={job.laborFee ? String(job.laborFee) : ""} placeholder="0" onChange={(e) => patch({ laborFee: num(e.target.value) })} disabled={locked} />
          </div>
          <div className="flex items-end justify-between border-t border-outline-variant mt-space-lg pt-space-md">
            <div>
              <div className="font-headline text-headline-md">Total Bill</div>
              {job.estimate > 0 && <div className="font-label text-label-sm text-on-surface-variant">Quoted {inr(job.estimate)}</div>}
            </div>
            <div className="font-label text-headline-lg font-bold text-tertiary">{inr(bill)}</div>
          </div>
          <div className="mt-space-lg">
            <Label>Payment status</Label>
            <div className="grid grid-cols-3 gap-space-sm mt-1">
              {(["Unpaid", "Partial Advance", "Fully Paid"] as Payment[]).map((p) => {
                const on = job.payment === p;
                return (
                  <button key={p} disabled={locked} onClick={() => pay(p)} className={`min-h-[56px] rounded-lg border px-1 font-headline text-body-sm font-semibold transition-colors duration-100 ${
                    on ? (p === "Fully Paid" ? "bg-tertiary-container/20 border-tertiary text-tertiary" : p === "Unpaid" ? "bg-error-container/20 border-error text-error" : "bg-amber/10 border-amber text-amber")
                       : "bg-surface-container border-outline-variant text-on-surface-variant"}`}>
                    {on && <Icon name="check" className="!text-[14px] mr-0.5" />}{p}
                  </button>
                );
              })}
            </div>
            {job.payment === "Partial Advance" && (
              <Field className="mt-space-md" label="Advance received" icon="currency_rupee" mono inputMode="numeric" value={job.advance ? String(job.advance) : ""} onChange={(e) => patch({ advance: num(e.target.value) })} placeholder="1000" disabled={locked} />
            )}
          </div>
        </Card>
      </div>

      <div className="action-dock flex flex-col gap-space-sm">
        {job.status === "Ready for Delivery" && <Button variant="success" icon="how_to_reg" onClick={() => go(`/handover/${job.id}`)}>Start Customer Handover</Button>}
        <a href={whatsappStatus(job, settings.shopName)} target="_blank" rel="noreferrer" className="min-h-[48px] w-full rounded-lg flex items-center justify-center gap-space-sm font-headline font-semibold text-body-md bg-surface-container border border-outline-variant active:scale-[0.98]"><Icon name="chat" className="text-tertiary" />Send WhatsApp Status Update</a>
        {!locked && <Button onClick={sync} busy={busy} icon="sync" variant={dirty || entry.trim() ? "primary" : "secondary"}>Update Status &amp; Sync Sheet</Button>}
      </div>

      {zoom && (
        <div className="fixed inset-0 z-50 bg-surface-dim/95 flex items-center justify-center p-4" onClick={() => setZoom("")}>
          <img src={zoom} alt="" className="max-w-full max-h-full rounded-xl" />
          <IconButton icon="close" label="Close" className="absolute top-4 right-4" />
        </div>
      )}
    </div>
  );
}
