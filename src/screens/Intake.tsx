import { useMemo, useRef, useState } from "react";
import { Waveform, useDictation } from "../components";
import { compressImage, fmtTime, inr, toLocalInput, waLink, digits } from "../lib/format";
import { customersFrom, searchCustomers } from "../lib/customers";
import { priorVisits } from "../lib/desk";
import { finalBill } from "../types";
import { useStore } from "../store";
import { Button, Card, CardTitle, Chip, Field, Icon, IconButton, IconLink, Label, Switch, TextArea } from "../ui";
import { DAMAGE_OPTIONS, type Job } from "../types";

function PhotoSlot({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex-1 min-w-0">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await compressImage(f));
          e.target.value = "";
        }}
      />
      {value ? (
        <div className="relative h-36 rounded-xl overflow-hidden border border-outline-variant">
          <img src={value} alt={label} className="w-full h-full object-cover" />
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 h-6 rounded-lg bg-surface-dim/80 font-label text-label-sm text-tertiary">
            <Icon name="check_circle" fill className="!text-[14px]" />{label.toUpperCase()}
          </span>
          <button type="button" onClick={() => ref.current?.click()} className="absolute bottom-2 right-2 flex items-center gap-1 px-2 h-8 rounded-lg bg-surface-dim/85 border border-outline-variant font-label text-label-md">
            <Icon name="refresh" className="!text-[16px]" />Retake
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current?.click()} className="w-full h-36 rounded-xl border border-dashed border-outline flex flex-col items-center justify-center gap-1 px-2 text-center bg-surface-container-lowest active:bg-surface-container transition-colors duration-100">
          <span className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-primary"><Icon name="add_a_photo" /></span>
          <span className="font-headline text-body-md font-semibold leading-tight">{label}</span>
          <span className="text-body-sm text-on-surface-variant leading-tight">{hint}</span>
        </button>
      )}
    </div>
  );
}

export default function Intake({ go }: { go: (p: string) => void }) {
  const { nextTicket, saveJob, settings, notify, jobs } = useStore();
  const [now] = useState(() => new Date());
  const [ticket] = useState(nextTicket);
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(17, 0, 0, 0);

  const [f, setF] = useState({
    name: "", phone: "", email: "", model: "", serial: "", pin: "", issue: "",
    adapter: false, bag: false, dongle: false, damage: [] as string[], conditionNote: "",
    photoFront: "", photoLabel: "", estimate: "", expectedDelivery: toLocalInput(tomorrow),
  });
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameFocus, setNameFocus] = useState(false);
  const [err, setErr] = useState<Record<string, boolean>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const dict = useDictation((t) => setF((p) => ({ ...p, issue: (p.issue ? p.issue + " " : "") + t })));
  const customers = useMemo(() => customersFrom(jobs), [jobs]);
  const hits = useMemo(() => searchCustomers(customers, f.name).filter((x) => x.name.toLowerCase() !== f.name.trim().toLowerCase()).slice(0, 6), [customers, f.name]);
  const fillCustomer = (c: { name: string; phone: string; email: string }) => {
    setF((p) => ({ ...p, name: c.name || p.name, phone: c.phone || p.phone, email: c.email || p.email }));
    setNameFocus(false);
  };
  // Contact Picker API: Chrome on Android (HTTPS). Not available on iOS Safari or desktop.
  const fromContacts = async () => {
    try {
      const [c] = await (navigator as any).contacts.select(["name", "tel", "email"], { multiple: false });
      if (c) fillCustomer({ name: c.name?.[0] ?? "", phone: c.tel?.[0] ?? "", email: c.email?.[0] ?? "" });
    } catch { /* cancelled */ }
  };
  const earlier = useMemo(() => priorVisits(jobs, f.phone, f.name), [jobs, f.phone, f.name]);
  const lastVisit = earlier[0];
  const returning = earlier.length > 0;

  const submit = async () => {
    const e = { name: !f.name.trim(), phone: digits(f.phone).length < 7, model: !f.model.trim() };
    setErr(e);
    if (e.name || e.phone || e.model) { notify("Fill in customer name, phone and laptop model"); return; }
    setBusy(true);
    const job: Job = {
      id: ticket, dateIn: now.toISOString(), name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(),
      model: f.model.trim(), serial: f.serial.trim(), pin: f.pin, issue: f.issue.trim(),
      adapter: f.adapter, bag: f.bag, dongle: f.dongle, damage: f.damage, conditionNote: f.conditionNote.trim(),
      photoFront: f.photoFront, photoLabel: f.photoLabel, tech: settings.technician, status: "Received",
      estimate: Number(f.estimate) || 0, expectedDelivery: f.expectedDelivery, partsCost: 0, laborFee: 0, payment: "Unpaid", advance: 0,
      dateRepaired: "", dateDelivered: "", signature: "", adapterReturned: false, bagReturned: false, workLog: [], synced: false,
    };
    const { status: r, id: savedId } = await saveJob(job);
    setBusy(false);
    notify(r === "synced" ? `${savedId} logged to Google Sheets` : r === "queued" ? `${savedId} saved on device — connect a Sheet in Settings to sync` : `${savedId} saved — Sheet sync failed, will retry`);
    go(`/job/${savedId}`);
  };

  return (
    <div className="pb-32">
      <div className="px-margin pt-space-xl pb-space-md flex items-center justify-between">
        <div>
          <div className="font-label text-label-md text-white/70">New intake</div>
          <div className="font-headline text-headline-lg text-white">#{ticket}</div>
        </div>
        <div className="text-right font-label text-label-md text-on-surface-variant">
          {now.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
          <div className="text-on-surface">{fmtTime(now.toISOString())}</div>
        </div>
      </div>

      <div className="px-margin py-space-lg flex flex-col gap-space-lg">
        <Card>
          <CardTitle icon="photo_camera" hint="2 photos">Hardware inspection</CardTitle>
          <div className="flex gap-space-sm">
            <PhotoSlot label="Laptop / Model Label" hint="Front of laptop + model sticker" value={f.photoFront} onChange={(v) => set("photoFront", v)} />
            <PhotoSlot label="Condition / Scratches" hint="Dents, cracks, hinges" value={f.photoLabel} onChange={(v) => set("photoLabel", v)} />
          </div>
        </Card>

        <Card>
          <CardTitle icon="mic" hint={dict.listening ? "● Listening" : dict.supported ? "Voice ready" : "Typing only"} hintClass={dict.listening ? "text-error" : "text-tertiary"}>Voice intake</CardTitle>
          <div className="flex flex-col items-center gap-space-sm py-space-sm mb-space-md bg-surface-container-lowest rounded-lg border border-outline-variant">
            <Waveform active={dict.listening} />
            <button
              type="button"
              onClick={dict.toggle}
              aria-label={dict.listening ? "Stop recording" : "Start recording"}
              className={`w-16 h-16 rounded-pill flex items-center justify-center transition-all duration-100 active:scale-95 ${
                dict.listening ? "bg-error-container text-on-error-container ring-4 ring-error/30" : "bg-primary-container border-2 border-accent text-on-primary-container"
              }`}
            >
              <Icon name={dict.listening ? "stop" : "mic"} className="!text-[32px]" fill />
            </button>
            <p className="text-body-sm text-on-surface-variant text-center px-space-lg">
              Tap &amp; speak: Describe customer issue, diagnostics needed, and technician notes.
            </p>
          </div>
          <Label>Live transcript (editable)</Label>
          <TextArea
            rows={4}
            value={f.issue + (dict.interim ? (f.issue ? " " : "") + dict.interim : "")}
            onChange={(e) => set("issue", e.target.value)}
            placeholder="Customer states laptop turns on but screen stays black…"
            className="mt-1"
          />
        </Card>

        <Card>
          <CardTitle icon="person" hint={returning ? "Returning client" : undefined}>Customer details</CardTitle>
          <div className="flex flex-col gap-space-md">
            <div className="relative">
              <Label>Customer name *</Label>
              <div className="flex gap-space-sm">
                <Field className={`flex-1 min-w-0 ${err.name ? "[&>div]:!border-error" : ""}`} icon="badge" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Type or pick a customer" autoComplete="off"
                  onFocus={() => setNameFocus(true)} onBlur={() => setTimeout(() => setNameFocus(false), 150)} />
                {"contacts" in navigator && "ContactsManager" in window && <IconButton icon="contacts" label="Phone contacts" onClick={fromContacts} />}
              </div>
              {nameFocus && hits.length > 0 && (
                <ul className="absolute z-20 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-accent bg-surface-container shadow-lg">
                  {hits.map((h) => (
                    <li key={h.name + h.phone}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => fillCustomer(h)} className="w-full flex items-center gap-space-md px-space-lg py-space-md text-left hover:bg-surface-container-high active:bg-surface-container-high">
                        <span className="w-9 h-9 rounded-full bg-secondary-container text-on-secondary-container font-headline font-bold text-body-sm flex items-center justify-center shrink-0">{h.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}</span>
                        <span className="flex-1 min-w-0"><span className="block font-headline font-semibold truncate">{h.name}</span><span className="block font-label text-label-md text-on-surface-variant">{h.phone || "No phone"}</span></span>
                        {h.visits > 1 && <span className="font-label text-label-sm text-primary">{h.visits} VISITS</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <Label>Phone number *</Label>
              <div className="flex gap-space-sm">
                <Field icon="call" type="tel" inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98765 43210" className={`flex-1 min-w-0 ${err.phone ? "[&>div]:!border-error" : ""}`} />
                <IconLink icon="chat" label="WhatsApp" tone="green" href={waLink(f.phone, "Hello from " + settings.shopName)} />
                <IconLink icon="phone_forwarded" label="Call" href={`tel:${digits(f.phone)}`} />
              </div>
            </div>
            {lastVisit && (
              <div className="rounded-xl bg-white/10 border border-white/10 px-4 py-3">
                <div className="font-label text-label-md text-primary">{earlier.length} earlier {earlier.length === 1 ? "visit" : "visits"}</div>
                <div className="font-body text-body-sm text-white/80 mt-1">
                  Last {new Date(lastVisit.dateIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {lastVisit.issue.trim().slice(0, 48) || lastVisit.model} · {inr(finalBill(lastVisit) || lastVisit.estimate)}
                </div>
              </div>
            )}
            <Field label="Email (optional)" icon="mail" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="name@email.com" />
          </div>
        </Card>

        <Card>
          <CardTitle icon="laptop_mac">Hardware specification</CardTitle>
          <div className="flex flex-col gap-space-md">
            <Field label="Brand & model *" icon="devices" value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="Dell Inspiron 15, MacBook Air M2" className={err.model ? "[&>div]:!border-error" : ""} />
            <Field label="Serial / service tag" mono value={f.serial} onChange={(e) => set("serial", e.target.value.toUpperCase())} placeholder="PF-3X992M" trailing={<Icon name="qr_code_scanner" className="text-outline" />} />
            <Field
              label="Password / PIN / pattern note"
              icon="lock"
              type={showPin ? "text" : "password"}
              value={f.pin}
              onChange={(e) => set("pin", e.target.value)}
              placeholder="Optional"
              autoComplete="off"
              trailing={<button type="button" aria-label="Show or hide" onClick={() => setShowPin(!showPin)}><Icon name={showPin ? "visibility_off" : "visibility"} className="text-outline" /></button>}
            />
          </div>
        </Card>

        <Card>
          <CardTitle icon="inventory_2" hint={`Tally: ${[f.adapter, f.bag, f.dongle].filter(Boolean).length} included`}>Accessory checklist</CardTitle>
          <div className="flex flex-col gap-space-sm">
            <Switch on={f.adapter} onChange={(v) => set("adapter", v)} label="Charger / Power Adapter" sub={f.adapter ? "Provided by customer" : "Not provided"} />
            <Switch on={f.bag} onChange={(v) => set("bag", v)} label="Laptop Bag / Sleeve" sub={f.bag ? "Included" : "Not provided"} />
            <Switch on={f.dongle} onChange={(v) => set("dongle", v)} label="External Mouse / Dongle" sub={f.dongle ? "Included" : "None received"} />
          </div>
          <div className="mt-space-lg">
            <Label>Existing physical damage noted</Label>
            <div className="flex flex-wrap gap-space-sm mt-1">
              {DAMAGE_OPTIONS.map((d) => (
                <Chip key={d} tone="error" icon={f.damage.includes(d) ? "close" : undefined} active={f.damage.includes(d)} onClick={() => set("damage", f.damage.includes(d) ? f.damage.filter((x) => x !== d) : [...f.damage, d])}>{d}</Chip>
              ))}
            </div>
            <Field className="mt-space-md" icon="edit_note" value={f.conditionNote} onChange={(e) => set("conditionNote", e.target.value)} placeholder="Other scratches / notes" />
          </div>
        </Card>

        <Card>
          <CardTitle icon="payments">Estimate &amp; delivery</CardTitle>
          <div className="grid grid-cols-2 gap-space-md">
            <Field label="Estimated quote" icon="currency_rupee" mono inputMode="numeric" value={f.estimate} onChange={(e) => set("estimate", e.target.value.replace(/\D/g, ""))} placeholder="2400" />
            <div>
              <Label>Expected delivery</Label>
              <input type="datetime-local" value={f.expectedDelivery} onChange={(e) => set("expectedDelivery", e.target.value)} className="w-full h-12 px-2 bg-surface-container-lowest border border-outline-variant rounded-lg font-label text-label-md text-on-surface [color-scheme:dark] focus:border-accent" />
            </div>
          </div>
        </Card>
      </div>

      <div className="action-dock">
        <Button onClick={submit} busy={busy} icon="table_view">Log Service to Google Sheets</Button>
      </div>
    </div>
  );
}
