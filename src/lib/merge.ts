import { STATUSES, finalBill, type Job, type Payment } from "../types";

/** One Sheet row, keyed by the column headers (see SHEET_COLUMNS). */
export type SheetRow = Record<string, string | number>;

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const yes = (v: unknown) => /^(y|yes|true|1)$/i.test(s(v));
const iso = (v: unknown) => {
  const t = s(v);
  if (!t) return "";
  const d = new Date(t);
  return isNaN(+d) ? "" : d.toISOString();
};

const blank = (): Job => ({
  id: "", dateIn: "", name: "", phone: "", email: "", model: "", serial: "", pin: "", issue: "",
  adapter: false, bag: false, dongle: false, damage: [], conditionNote: "", photoFront: "", photoLabel: "",
  tech: "", status: "Received", estimate: 0, expectedDelivery: "", partsCost: 0, laborFee: 0, payment: "Unpaid",
  advance: 0, dateRepaired: "", dateDelivered: "", signature: "", adapterReturned: false, bagReturned: false,
  workLog: [], synced: true,
});

/**
 * Builds a Job from a Sheet row. Fields the Sheet doesn't have (PIN, photos, work log,
 * signature, e-mail…) are kept from the local copy; everything the Sheet does have wins.
 */
export function rowToJob(r: SheetRow, local?: Job): Job | null {
  const id = s(r.Ticket_ID);
  if (!id) return null;
  const base = local ?? blank();
  const status = STATUSES.find((x) => x.toLowerCase() === s(r.Repair_Status).toLowerCase()) ?? base.status;
  const payment = (["Unpaid", "Partial Advance", "Fully Paid"] as Payment[]).find((x) => x.toLowerCase() === s(r.Payment_Status).toLowerCase()) ?? base.payment;

  const cond = s(r.Physical_Condition_Notes);
  const localCond = [...base.damage, base.conditionNote].filter(Boolean).join("; ");

  // The Sheet only stores the total; keep our parts/labour split unless the total changed.
  const total = Number(r.Final_Bill) || 0;
  let { partsCost, laborFee } = base;
  if (total && total !== finalBill(base)) {
    partsCost = Math.min(partsCost, total);
    laborFee = total - partsCost;
  }

  return {
    ...base,
    id,
    dateIn: iso(r.Date_In) || base.dateIn || new Date().toISOString(),
    name: s(r.Customer_Name),
    phone: s(r.Customer_Phone),
    model: s(r.Laptop_Brand_Model),
    serial: s(r.Serial_Number),
    issue: s(r.Issues_Reported_Voice_Text),
    adapter: yes(r.Adapter_Included),
    bag: yes(r.Bag_Included),
    ...(cond === localCond ? {} : { damage: [], conditionNote: cond }),
    photoFrontUrl: s(r.Photo_URL_Front) || base.photoFrontUrl,
    photoLabelUrl: s(r.Photo_URL_Label) || base.photoLabelUrl,
    tech: s(r.Assigned_Technician) || base.tech,
    status,
    payment,
    estimate: Number(r.Estimated_Cost) || 0,
    partsCost,
    laborFee,
    dateRepaired: iso(r.Date_Repaired),
    dateDelivered: iso(r.Date_Delivered),
    synced: true,
  };
}

/**
 * Demo tickets that early builds seeded into local storage. They were never real data, so they are
 * dropped on load and can never be pushed to the Sheet.
 */
const DEMO = new Set(["TKT-1082|Vikram Sharma", "TKT-1079|Ananya Roy", "TKT-1075|Karthik Raja"]);
export const isDemoJob = (j: Job) => DEMO.has(`${j.id}|${j.name}`) && /^\+91 98(765 43210|100 22334|201 11223)$/.test(j.phone);

/**
 * Make the local list match the Sheet. The Sheet is the source of truth:
 *  - every Sheet row becomes a ticket (our device-only extras — photos, work log, PIN — are kept);
 *  - tickets that were synced before but are no longer in the Sheet are removed;
 *  - tickets with unsynced local edits are kept untouched and pushed on the next sync.
 */
export function mergeRows(local: Job[], rows: SheetRow[]) {
  const mine = new Map(local.map((j) => [j.id, j]));
  const seen = new Set<string>();
  const fromSheet: Job[] = [];
  let added = 0, updated = 0;
  for (const r of rows) {
    const id = s(r.Ticket_ID);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const m = mine.get(id);
    if (m && !m.synced) continue; // local edits win until pushed
    const next = rowToJob(r, m);
    if (!next) continue;
    if (!m) added++;
    else if (JSON.stringify(next) !== JSON.stringify(m)) updated++;
    fromSheet.push(m && JSON.stringify(next) === JSON.stringify(m) ? m : next);
  }
  const pending = local.filter((j) => !j.synced);
  const removed = local.filter((j) => j.synced && !seen.has(j.id)).length;
  return { jobs: [...pending, ...fromSheet], added, updated, removed };
}
