import type { SheetRow } from "./merge";
import { finalBill, type Job } from "../types";

export interface Settings { sheetUrl: string; sheetSecret: string; appLock: boolean; technician: string; shopName: string; shopPhone: string }
export const defaultSettings: Settings = { sheetUrl: "", sheetSecret: "", appLock: true, technician: "Amit Verma", shopName: "Infizo", shopPhone: "" };

const isData = (s: string) => s.startsWith("data:");

/** Only Google Apps Script web-app endpoints over HTTPS are accepted. */
export function isValidSheetUrl(u: string): boolean {
  try {
    const x = new URL(u.trim());
    return x.protocol === "https:" && x.hostname === "script.google.com" && /^\/macros\/s\/[\w-]+\/exec$/.test(x.pathname);
  } catch { return false; }
}

export class SheetError extends Error {
  constructor(message: string, public code?: string, public nextId?: string) { super(message); }
}

/** Maps a Job to the Google Sheet columns (see SHEET_COLUMNS). */
export function toRow(j: Job) {
  return {
    Ticket_ID: j.id,
    Date_In: j.dateIn,
    Customer_Name: j.name,
    Customer_Phone: j.phone,
    Laptop_Brand_Model: j.model,
    Serial_Number: j.serial,
    Issues_Reported_Voice_Text: j.issue,
    Adapter_Included: j.adapter ? "Yes" : "No",
    Bag_Included: j.bag ? "Yes" : "No",
    Physical_Condition_Notes: [...j.damage, j.conditionNote].filter(Boolean).join("; "),
    Photo_URL_Front: j.photoFrontUrl || "",
    Photo_URL_Label: j.photoLabelUrl || "",
    Assigned_Technician: j.tech,
    Repair_Status: j.status,
    Estimated_Cost: j.estimate,
    Final_Bill: finalBill(j) || "",
    Payment_Status: j.payment,
    Date_Repaired: j.dateRepaired,
    Date_Delivered: j.dateDelivered,
    Customer_Signature_Status: j.signature ? "Signed" : "Pending",
  };
}

/**
 * Upserts the job row (keyed by Ticket_ID) through the Apps Script web app.
 * Photos not yet uploaded are sent as data URLs; the script stores them in a private
 * Drive folder and returns their (owner-only) links. The local copy stays on the device.
 * Throws SheetError("conflict", nextId) if another device already used this ticket number.
 */
export async function pushJob(url: string, secret: string, j: Job): Promise<{ photoFrontUrl?: string; photoLabelUrl?: string }> {
  if (!isValidSheetUrl(url)) throw new SheetError("Invalid Google Sheet URL", "bad_url");
  if (!secret) throw new SheetError("Missing shared secret", "unauthorized");
  const body = {
    action: "upsert",
    secret,
    row: toRow(j),
    photos: {
      front: !j.photoFrontUrl && isData(j.photoFront) ? j.photoFront : undefined,
      label: !j.photoLabelUrl && isData(j.photoLabel) ? j.photoLabel : undefined,
    },
  };
  // text/plain keeps this a "simple" request so Apps Script needs no CORS preflight.
  const out = await postJson(url, body);
  if (!out.ok) throw new SheetError(out.error || "Sheet rejected the row", out.code, out.nextId);
  return { photoFrontUrl: out.photoFront, photoLabelUrl: out.photoLabel };
}

const TIMEOUT_MS = 45_000; // Apps Script can take 10–20 s on a cold start; never hang forever

/** POST helper: text/plain keeps it a "simple" request so Apps Script needs no CORS preflight. */
async function postJson(url: string, body: object): Promise<any> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.trim(), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), signal: ctl.signal });
  } catch (e) {
    throw new SheetError(ctl.signal.aborted ? "Google didn't answer in time — try again" : "No connection to Google (check internet)", "network");
  } finally {
    clearTimeout(timer);
  }
  try {
    return await res.json();
  } catch {
    // Google answered with a web page (sign-in / error) instead of JSON
    throw new SheetError(`Script didn't return data (HTTP ${res.status}) — redeploy it as Web app with access “Anyone” and paste the newest /exec URL`, "not_json");
  }
}

async function call(url: string, secret: string, body: object) {
  return postJson(url, { ...body, secret });
}

/** Connection test (the script requires the secret for this too). */
export async function pingSheet(url: string, secret: string): Promise<"ok" | "unauthorized" | "bad_url" | "unreachable"> {
  if (!isValidSheetUrl(url)) return "bad_url";
  try {
    const j = await call(url, secret, { action: "ping" });
    return j.ok ? "ok" : "unauthorized";
  } catch { return "unreachable"; }
}

/** All rows currently in the Sheet (hand-typed rows get a Ticket_ID/Date_In from the script first). */
export async function pullRows(url: string, secret: string): Promise<{ rows: SheetRow[]; sheet: string }> {
  if (!isValidSheetUrl(url)) throw new SheetError("Invalid Google Sheet URL", "bad_url");
  const out = await call(url, secret, { action: "list" });
  if (!out.ok) {
    throw new SheetError(
      out.code === "unauthorized" ? "Wrong shared secret" : out.error === "Bad request" ? "Script is out of date — paste the latest Code.gs and deploy a New version" : out.error || "Could not read the Sheet",
      out.code,
    );
  }
  if (!Array.isArray(out.rows)) throw new SheetError("Script is out of date — paste the latest Code.gs and deploy a New version", "outdated");
  return { rows: out.rows as SheetRow[], sheet: String(out.sheet || "") };
}
