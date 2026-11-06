import { useEffect, useRef, useState } from "react";
import { fmtDateTime, inr } from "../lib/format";
import { useStore } from "../store";
import { Button, Card, CardTitle, EmptyState, Icon, IconLink, ScreenHeader } from "../ui";
import { balanceDue, finalBill, type Job } from "../types";

function SignaturePad({ onChange }: { onChange: (png: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = r.width * dpr; c.height = r.height * dpr;
    const x = c.getContext("2d")!;
    x.scale(dpr, dpr); x.lineWidth = 2.5; x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = "#b4c5ff";
  }, []);

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const down = (e: React.PointerEvent) => {
    drawing.current = true; ref.current!.setPointerCapture(e.pointerId);
    const x = ref.current!.getContext("2d")!; const [px, py] = pos(e); x.beginPath(); x.moveTo(px, py); x.lineTo(px + 0.1, py); x.stroke();
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const x = ref.current!.getContext("2d")!; const [px, py] = pos(e); x.lineTo(px, py); x.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false; setEmpty(false);
    // export on a white background so the invoice/sheet copy is readable
    const c = ref.current!; const o = document.createElement("canvas"); o.width = c.width; o.height = c.height;
    const x = o.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(0, 0, o.width, o.height);
    x.filter = "invert(1) hue-rotate(180deg)"; x.drawImage(c, 0, 0);
    onChange(o.toDataURL("image/png"));
  };
  const clear = () => {
    const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange("");
  };

  return (
    <div>
      <div className="relative">
        <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} className="w-full h-40 bg-surface-container-lowest border border-accent rounded-lg touch-none" />
        {empty && <span className="absolute inset-0 flex items-center justify-center text-outline font-label text-label-md pointer-events-none">Customer signs here</span>}
      </div>
      <button onClick={clear} className="mt-space-sm h-10 px-space-md rounded-lg border border-outline-variant text-on-surface-variant font-label text-label-md flex items-center gap-1"><Icon name="refresh" className="!text-[16px]" />Clear / Resign</button>
    </div>
  );
}

const Check = ({ on, onChange, title, sub, tag }: { on: boolean; onChange: (v: boolean) => void; title: string; sub: string; tag: string }) => (
  <button onClick={() => onChange(!on)} role="checkbox" aria-checked={on} className={`w-full text-left flex gap-space-md p-space-md rounded-lg border transition-colors duration-100 ${on ? "bg-surface-container-lowest border-tertiary/60" : "bg-surface-container border-outline-variant"}`}>
    <span className={`mt-0.5 w-6 h-6 rounded shrink-0 flex items-center justify-center border-2 ${on ? "bg-primary-container border-accent" : "border-outline"}`}>{on && <Icon name="check" className="!text-[18px] text-on-primary-container" />}</span>
    <span className="flex-1 min-w-0"><span className="block font-headline text-body-md font-semibold">{title}</span><span className={`block text-body-sm ${on ? "text-tertiary" : "text-on-surface-variant"}`}>{sub}</span></span>
    <span className="self-start px-1.5 h-5 flex items-center rounded bg-surface-variant font-label text-label-sm text-on-surface-variant uppercase">{tag}</span>
  </button>
);

export default function Handover({ id, go }: { id: string; go: (p: string) => void }) {
  const { jobs, saveJob, notify } = useStore();
  const stored = jobs.find((j) => j.id === id);
  const [job, setJob] = useState<Job | undefined>(stored);
  const [sig, setSig] = useState(stored?.signature || "");
  const [busy, setBusy] = useState(false);
  const [cosmetic, setCosmetic] = useState(false);
  if (!job) return (<><ScreenHeader title="Handover" onBack={() => go("/")} /><EmptyState icon="error" title="Ticket not found" /></>);

  const patch = (p: Partial<Job>) => setJob((j) => ({ ...j!, ...p }));
  const done = job.status === "Delivered";
  const bill = finalBill(job) || job.estimate;
  const due = balanceDue(job);
  const needAdapter = job.adapter, needBag = job.bag;
  const checks = [needAdapter ? job.adapterReturned : true, needBag ? job.bagReturned : true, cosmetic || done];
  const verified = checks.filter(Boolean).length;
  const ready = verified === 3 && (!!sig || done);

  const complete = async () => {
    if (!ready) return;
    setBusy(true);
    const j: Job = { ...job, status: "Delivered", dateDelivered: new Date().toISOString(), signature: sig, payment: due === 0 ? "Fully Paid" : job.payment };
    const { status: r } = await saveJob(j);
    setJob(j);
    setBusy(false);
    notify(r === "synced" ? "Handover complete — Sheet updated" : "Handover complete — saved on device");
    go("/done");
  };

  return (
    <div className="pb-56">
      <ScreenHeader onBack={() => go(`/job/${job.id}`)} title="Handover & Delivery" sub={`#${job.id}`} />
      <div className="px-margin py-space-lg flex flex-col gap-space-lg">
        <Card accent>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-label text-label-sm text-on-surface-variant uppercase flex items-center gap-1"><Icon name="laptop_mac" className="!text-[14px]" />Hardware asset</div>
              <div className="font-headline text-headline-md mt-1">{job.model}</div>
            </div>
            <span className={`px-2 h-7 flex items-center rounded-lg border font-label text-label-md uppercase ${due === 0 ? "border-tertiary text-tertiary bg-tertiary-container/20" : "border-error text-error"}`}>{due === 0 ? "Paid in full" : "Balance due"}</span>
          </div>
          <div className="flex items-center gap-space-md mt-space-md p-space-md bg-surface-container-lowest rounded-lg">
            <Icon name="person" className="text-outline" />
            <div className="flex-1"><div className="font-headline font-semibold">{job.name}</div><div className="font-label text-label-md text-on-surface-variant">{job.phone}</div></div>
            <IconLink icon="call" label="Call" href={`tel:${job.phone.replace(/[^\d+]/g, "")}`} />
          </div>
          {job.workLog.length > 0 && (
            <div className="mt-space-md">
              <div className="font-label text-label-sm text-on-surface-variant uppercase mb-1">Bench scope completed</div>
              <div className="flex flex-col gap-1">{job.workLog.map((w, i) => <div key={i} className="flex gap-1 text-body-sm"><Icon name="check" className="!text-[16px] text-tertiary" />{w.text}</div>)}</div>
            </div>
          )}
          <div className="flex items-end justify-between border-t border-outline-variant mt-space-md pt-space-md">
            <span className="text-body-md text-on-surface-variant">Total handover balance</span>
            <span className={`font-label text-headline-lg font-bold ${due ? "text-error" : "text-tertiary"}`}>{inr(due)}</span>
          </div>
          {due > 0 && <button onClick={() => patch({ payment: "Fully Paid", advance: 0 })} className="mt-space-sm w-full h-10 rounded-lg border border-tertiary text-tertiary font-label text-label-md">Mark {inr(due)} received</button>}
        </Card>

        <Card>
          <CardTitle icon="inventory_2" hint={`${verified}/3 verified`}>Accessory return checklist</CardTitle>
          <div className="flex flex-col gap-space-sm">
            {needAdapter
              ? <Check on={job.adapterReturned} onChange={(v) => patch({ adapterReturned: v })} title="Charger / Power Adapter" sub="Returned & tested in presence of client" tag="Adapter" />
              : <Check on onChange={() => {}} title="No adapter was received" sub="Nothing to return" tag="N/A" />}
            {needBag
              ? <Check on={job.bagReturned} onChange={(v) => patch({ bagReturned: v })} title="Laptop Bag / Sleeve" sub="Returned to customer without defect" tag="Bag" />
              : <Check on onChange={() => {}} title="No bag was received" sub="Nothing to return" tag="N/A" />}
            <Check on={cosmetic || done} onChange={setCosmetic} title="Cosmetic condition matches intake" sub={[...job.damage, job.conditionNote].filter(Boolean).join(", ") || "No pre-existing damage noted"} tag="Condition" />
          </div>
        </Card>

        <Card>
          <CardTitle icon="draw" hint={job.signature ? "Signed" : undefined}>Client handover signature</CardTitle>
          {done && job.signature
            ? <img src={job.signature} alt="Signature" className="w-full h-40 object-contain bg-on-surface rounded-lg" />
            : <SignaturePad onChange={setSig} />}
          <p className="mt-space-sm font-label text-label-sm text-on-surface-variant">{job.name} · {sig || done ? "Signed " + fmtDateTime(job.dateDelivered || new Date().toISOString()) : "Awaiting signature"}</p>
        </Card>
      </div>

      {!done && (
        <div className="action-dock flex flex-col gap-space-sm">
          <Button onClick={complete} busy={busy} disabled={!ready} icon="table_view">Complete Handover &amp; Update Sheet</Button>
        </div>
      )}
    </div>
  );
}
