import { digits } from "./format";
import type { Job } from "../types";

export interface Customer { name: string; phone: string; email: string; visits: number; last: string }

/** Unique customers from existing tickets (i.e. whatever the Sheet has), most recent first. */
export function customersFrom(jobs: Job[]): Customer[] {
  const byKey = new Map<string, Customer>();
  for (const j of [...jobs].sort((a, b) => +new Date(b.dateIn) - +new Date(a.dateIn))) {
    if (!j.name.trim()) continue;
    const key = digits(j.phone).slice(-10) || j.name.trim().toLowerCase();
    const c = byKey.get(key);
    if (!c) byKey.set(key, { name: j.name.trim(), phone: j.phone, email: j.email, visits: 1, last: j.dateIn });
    else { c.visits++; if (!c.email && j.email) c.email = j.email; }
  }
  return [...byKey.values()];
}

export function searchCustomers(list: Customer[], q: string): Customer[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  const d = digits(s);
  return list.filter((c) => c.name.toLowerCase().includes(s) || (d.length >= 3 && digits(c.phone).includes(d)));
}
