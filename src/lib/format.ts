import type { Job } from "../types";

export const inr = (n: number) => "₹ " + Math.round(n || 0).toLocaleString("en-IN");

export const daysInShop = (j: Job) => {
  const end = j.dateDelivered ? new Date(j.dateDelivered).getTime() : Date.now();
  return Math.max(0, Math.floor((end - new Date(j.dateIn).getTime()) / 86400000));
};
export const shopAge = (j: Job) => {
  const d = daysInShop(j);
  return d === 0 ? "In shop: today" : `In shop: ${d} day${d > 1 ? "s" : ""}`;
};

export const fmtDateTime = (iso: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" }) : "—";
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
export const fmtDelivery = (v: string) => {
  if (!v) return "Not set";
  const d = new Date(v);
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
  const t = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (diff === 0) return `Today, ${t}`;
  if (diff === 1) return `Tomorrow, ${t}`;
  return `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}, ${t}`;
};

export const digits = (p: string) => p.replace(/\D/g, "");
export const waNumber = (p: string) => {
  const d = digits(p);
  return d.length === 10 ? "91" + d : d;
};
export const waLink = (p: string, msg: string) => `https://wa.me/${waNumber(p)}?text=${encodeURIComponent(msg)}`;

/** value for <input type="datetime-local"> */
export const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Downscale a captured photo so it fits in localStorage / uploads quickly. */
export const compressImage = (file: File, max = 900, quality = 0.7) =>
  new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Could not read image"));
    img.src = url;
  });

/** Escape text before placing it in generated HTML (invoices). */
export const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
