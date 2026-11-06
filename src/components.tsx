import { useEffect, useRef, useState } from "react";
import { daysInShop, fmtDelivery, inr, shopAge, waLink, digits } from "./lib/format";
import { finalBill, type Job } from "./types";
import { Icon, IconLink, StatusPill, Thumb, YesNoBadge } from "./ui";

export function JobCard({ job, onOpen }: { job: Job; onOpen: () => void }) {
  const done = job.status === "Delivered";
  const ready = job.status === "Ready for Delivery";
  const bill = finalBill(job);
  const aging = !done && daysInShop(job) >= 5;
  return (
    <article
      onClick={onOpen}
      className="glass rounded-xl overflow-hidden cursor-pointer active:bg-white/10 transition-colors duration-100"
    >
      <div className="p-space-lg pb-space-md flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-space-sm flex-wrap">
            <span className="font-label text-label-lg font-bold text-on-surface">#{job.id}</span>
            <StatusPill status={job.status} />
          </div>
          <div className={`mt-1 flex items-center gap-1 font-label text-label-md ${aging ? "text-error" : "text-on-surface-variant"}`}>
            <Icon name="schedule" className="!text-[14px]" />
            {shopAge(job)}
            {!job.synced && <span className="text-amber ml-1">· UNSYNCED</span>}
          </div>
        </div>
        {digits(job.phone) && (
          <IconLink icon="call" label={`Call ${job.name}`} href={`tel:${digits(job.phone)}`} />
        )}
      </div>
      <div className="px-space-lg pb-space-md">
        <div className="font-headline text-body-lg font-semibold">{job.model}</div>
        <div className="text-body-sm text-on-surface-variant">Client: {job.name}</div>
      </div>
      <div className="mx-space-md mb-space-md p-space-sm bg-black/20 rounded-lg flex gap-space-md">
        <Thumb src={job.photoFront} className="w-14 h-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-body-md text-on-surface line-clamp-2">{job.issue || "No issue description"}</p>
          <div className="mt-2 flex gap-space-sm flex-wrap">
            <YesNoBadge label="Adapter" yes={job.adapter} />
            {job.bag && <YesNoBadge label="Bag" yes />}
          </div>
        </div>
      </div>
      <div className="px-space-lg pb-space-lg flex items-center justify-between font-label text-label-md">
        <span className="text-on-surface-variant">
          {done || ready ? "Final Bill: " : "Est: "}
          <b className={`text-body-lg ${ready || done ? "text-tertiary" : "text-on-surface"}`}>{inr(bill || job.estimate)}</b>
        </span>
        {!done && (
          <span className="flex items-center gap-1 text-primary">
            <Icon name="local_shipping" className="!text-[16px]" />
            {fmtDelivery(job.expectedDelivery)}
          </span>
        )}
        {done && <span className="text-on-surface-variant">{job.payment}</span>}
      </div>
    </article>
  );
}

export function SearchBar({ value, onChange, placeholder = "Search Ticket #, Customer, Phone…" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="flex items-center gap-space-sm h-12 px-4 bg-white/10 border border-white/10 rounded-pill focus-within:border-white/40 transition-colors duration-150">
      <Icon name="search" className="text-outline" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="search"
        className="flex-1 min-w-0 h-full bg-transparent font-body text-body-md"
      />
      {value && <button aria-label="Clear" onClick={() => onChange("")}><Icon name="close" className="text-outline" /></button>}
    </div>
  );
}

export const matches = (j: Job, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const d = s.replace(/\D/g, "");
  return (
    j.id.toLowerCase().includes(s) || j.id.replace(/\D/g, "") === s.replace(/^#?tkt-?/, "") ||
    j.name.toLowerCase().includes(s) || j.model.toLowerCase().includes(s) || j.serial.toLowerCase().includes(s) ||
    (d.length >= 3 && digits(j.phone).includes(d))
  );
};

/** Speech-to-text hook (Web Speech API). Falls back gracefully where unsupported. */
export function useDictation(onText: (appended: string) => void) {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<any>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => () => rec.current?.stop(), []);

  const toggle = () => {
    if (!SR) { alert("Voice input isn't supported in this browser. Use Chrome/Edge/Safari, or type the notes."); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new SR();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let fin = "", tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) fin += t; else tmp += t;
      }
      if (fin) cb.current(fin.trim());
      setInterim(tmp);
    };
    r.onend = () => { setListening(false); setInterim(""); };
    r.onerror = () => { setListening(false); setInterim(""); };
    rec.current = r;
    r.start();
    setListening(true);
  };
  return { listening, interim, toggle, supported: !!SR };
}

export function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8" aria-hidden>
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-pill ${active ? "bg-primary animate-wave" : "bg-outline-variant"}`}
          style={{ height: active ? undefined : 6, animationDelay: `${(i * 67) % 400}ms`, animationDuration: `${0.6 + ((i * 37) % 70) / 100}s` }}
        />
      ))}
    </div>
  );
}

export const statusMessage = (j: Job, shop: string) => {
  const bill = finalBill(j);
  const base = `Hi ${j.name.split(" ")[0] || "there"}, update from ${shop} on your ${j.model} (${j.id}): `;
  switch (j.status) {
    case "Received": return base + "we've received your laptop and will start diagnosis shortly.";
    case "Diagnosing": return base + "our technician is diagnosing the issue. We'll update you with the quote.";
    case "Spare Parts Pending": return base + "we're waiting on spare parts to arrive. We'll confirm as soon as they're in.";
    case "Repaired & Testing": return base + "the repair is done and we're running final tests.";
    case "Ready for Delivery": return base + `your laptop is READY for pickup.${bill ? ` Total bill: ${inr(bill)}.` : ""} Please bring this ticket number.`;
    case "Delivered": return base + "thank you for collecting your laptop. Please reach out if you face any issue!";
  }
};
export const whatsappStatus = (j: Job, shop: string) => waLink(j.phone, statusMessage(j, shop));
