import { digits, inr } from "./format";
import { balanceDue, finalBill, type Job } from "../types";

export const sameDay = (iso: string, day = new Date()) => {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
};

/** Money already received on a ticket: the full bill, or the advance. */
export const collectedOn = (j: Job) => {
  const total = finalBill(j) || j.estimate || 0;
  if (j.payment === "Fully Paid") return total;
  if (j.payment === "Partial Advance") return Math.min(j.advance || 0, total || j.advance || 0);
  return 0;
};

export function owing(jobs: Job[]) {
  return jobs
    .map((job) => ({ job, due: balanceDue(job) }))
    .filter((x) => x.due > 0)
    .sort((a, b) => +new Date(a.job.dateIn) - +new Date(b.job.dateIn));
}

export function dayClose(jobs: Job[], day = new Date()) {
  const takenIn = jobs.filter((j) => sameDay(j.dateIn, day));
  const delivered = jobs.filter((j) => sameDay(j.dateDelivered, day));
  const collected = delivered.reduce((sum, j) => sum + collectedOn(j), 0);
  const outstanding = owing(jobs).reduce((sum, x) => sum + x.due, 0);
  return { takenIn, delivered, collected, outstanding };
}

/** Earlier tickets for this phone, or this exact name when the phone is still short. Newest first. */
export function priorVisits(jobs: Job[], phone: string, name: string): Job[] {
  const d = digits(phone).slice(-10);
  const n = name.trim().toLowerCase();
  return jobs
    .filter((j) => (d.length >= 7 && digits(j.phone).endsWith(d)) || (d.length < 7 && n.length >= 2 && j.name.trim().toLowerCase() === n))
    .sort((a, b) => +new Date(b.dateIn) - +new Date(a.dateIn));
}

export const reminderMessage = (j: Job, shop: string, due: number) => {
  const who = j.name.split(" ")[0] || "there";
  return `Hi ${who}, this is ${shop || "the shop"}. Your ${j.model || "device"} (${j.id}) still has a balance of ${inr(due)}. Please clear it when you can.`;
};
