import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import type { Status } from "./types";

export const Icon = ({ name, className = "", fill = false }: { name: string; className?: string; fill?: boolean }) => (
  <span className={`material-symbols-outlined ${fill ? "fill" : ""} ${className}`} aria-hidden>{name}</span>
);

export const Card = ({ children, className = "", accent = false }: { children: ReactNode; className?: string; accent?: boolean }) => (
  <section className={`glass rounded-xl p-space-lg ${accent ? "ring-1 ring-accent/40" : ""} ${className}`}>
    {children}
  </section>
);

export const CardTitle = ({ icon, children, hint, hintClass = "text-tertiary" }: { icon: string; children: ReactNode; hint?: ReactNode; hintClass?: string }) => (
  <div className="flex items-center justify-between mb-space-lg gap-2">
    <h2 className="flex items-center gap-space-sm font-headline text-body-lg text-on-surface">
      <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
        <Icon name={icon} className="text-primary !text-[18px]" />
      </span>
      {children}
    </h2>
    {hint && <span className={`font-label text-label-sm ${hintClass}`}>{hint}</span>}
  </div>
);

export const Label = ({ children }: { children: ReactNode }) => (
  <label className="block font-label text-label-sm text-on-surface-variant mb-2">{children}</label>
);

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; icon?: string; mono?: boolean; trailing?: ReactNode }
export const Field = ({ label, icon, mono, trailing, className = "", ...rest }: FieldProps) => (
  <div className={className}>
    {label && <Label>{label}</Label>}
    <div className="flex items-center gap-space-sm h-12 px-space-md bg-white/5 border border-white/10 rounded-lg focus-within:border-white/40 transition-colors duration-150">
      {icon && <Icon name={icon} className="text-outline" />}
      <input {...rest} className={`flex-1 min-w-0 h-full bg-transparent text-on-surface ${mono ? "font-label text-label-lg" : "font-body text-body-md"}`} />
      {trailing}
    </div>
  </div>
);

export const TextArea = ({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...rest} className={`w-full bg-white/5 border border-white/10 rounded-lg p-space-md text-on-surface font-body text-body-md resize-none focus:border-white/40 transition-colors duration-150 ${className}`} />
);

type BtnVariant = "primary" | "secondary" | "ghost" | "success" | "danger";
const variants: Record<BtnVariant, string> = {
  primary: "bg-gradient-to-r from-[#ff8a3d] via-[#e23d8c] to-[#7c3aed] text-white shadow-[0_8px_24px_rgba(124,58,237,0.28)]",
  secondary: "bg-white/10 border border-white/15 text-on-surface hover:bg-white/15",
  ghost: "border border-white/15 text-on-surface-variant hover:bg-white/10",
  success: "bg-tertiary-container/20 border border-tertiary text-tertiary hover:bg-tertiary-container/30",
  danger: "border border-error text-error hover:bg-error-container/20",
};
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: BtnVariant; icon?: string; busy?: boolean }
export const Button = ({ variant = "primary", icon, busy, children, className = "", disabled, ...rest }: BtnProps) => (
  <button
    {...rest}
    disabled={disabled || busy}
    className={`min-h-[52px] w-full px-space-lg rounded-pill flex items-center justify-center gap-space-sm font-headline font-semibold text-body-md transition-all duration-100 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 ${variants[variant]} ${className}`}
  >
    {busy ? <Icon name="progress_activity" className="animate-spin" /> : icon && <Icon name={icon} />}
    {children}
  </button>
);

export const IconButton = ({ icon, label, tone = "neutral", className = "", ...rest }: { icon: string; label: string; tone?: "neutral" | "green" } & ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    {...rest}
    aria-label={label}
    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center border transition-all duration-100 active:scale-95 ${
      tone === "green" ? "bg-tertiary-container/20 border-tertiary text-tertiary" : "bg-white/10 border-white/15 text-on-surface"
    } ${className}`}
  >
    <Icon name={icon} />
  </button>
);

export const IconLink = ({ icon, label, href, tone = "neutral" }: { icon: string; label: string; href: string; tone?: "neutral" | "green" }) => (
  <a
    href={href}
    target={href.startsWith("http") ? "_blank" : undefined}
    rel="noreferrer"
    aria-label={label}
    onClick={(e) => e.stopPropagation()}
    className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center border transition-all duration-100 active:scale-95 ${
      tone === "green" ? "bg-tertiary-container/20 border-tertiary text-tertiary" : "bg-white/10 border-white/15 text-on-surface"
    }`}
  >
    <Icon name={icon} />
  </a>
);

export const Switch = ({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className={`w-full flex items-center gap-space-md p-space-md rounded-xl border text-left transition-colors duration-150 ${
      on ? "bg-tertiary-container/10 border-tertiary/60" : "bg-white/5 border-white/10"
    }`}
  >
    <div className="flex-1 min-w-0">
      <div className="font-body text-body-md text-on-surface font-medium">{label}</div>
      <div className={`font-label text-label-sm ${on ? "text-tertiary" : "text-outline"}`}>{sub}</div>
    </div>
    <span className={`w-12 h-7 rounded-pill p-0.5 flex shrink-0 transition-colors duration-150 ${on ? "bg-tertiary justify-end" : "bg-surface-variant justify-start"}`}>
      <span className="w-6 h-6 rounded-pill bg-on-surface shadow" />
    </span>
  </button>
);

export const Chip = ({ children, active, tone = "primary", onClick, icon }: { children: ReactNode; active?: boolean; tone?: "primary" | "error"; onClick?: () => void; icon?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className={`shrink-0 inline-flex items-center gap-1 h-9 px-space-md rounded-pill border font-label text-label-md transition-colors duration-100 ${
      active
        ? tone === "error" ? "bg-error-container/30 border-error text-error" : "bg-white text-on-primary"
        : "bg-white/5 border-white/10 text-on-surface-variant"
    }`}
  >
    {icon && <Icon name={icon} className="!text-[14px]" />}
    {children}
  </button>
);

const statusTone: Record<Status, string> = {
  Received: "bg-accent/20 border-accent text-primary",
  Diagnosing: "bg-amber/10 border-amber text-amber",
  "Spare Parts Pending": "bg-amber/10 border-amber text-amber",
  "Repaired & Testing": "bg-amber/10 border-amber text-amber",
  "Ready for Delivery": "bg-tertiary-container/20 border-tertiary text-tertiary",
  Delivered: "bg-surface-variant border-outline text-on-surface-variant",
};
const statusLabel: Record<Status, string> = {
  Received: "Received", Diagnosing: "In Diagnosis", "Spare Parts Pending": "Waiting on Parts",
  "Repaired & Testing": "Testing", "Ready for Delivery": "Ready for Pickup", Delivered: "Delivered",
};
export const StatusPill = ({ status }: { status: Status }) => (
  <span className={`inline-flex items-center h-7 px-3 rounded-pill border font-label text-label-sm ${statusTone[status]}`}>{statusLabel[status]}</span>
);

export const YesNoBadge = ({ label, yes }: { label: string; yes: boolean }) => (
  <span className={`inline-flex items-center gap-1 h-7 px-space-sm rounded-lg border font-label text-label-md ${
    yes ? "border-tertiary text-tertiary bg-tertiary-container/10" : "border-error text-error"
  }`}>
    <Icon name={yes ? "check" : "close"} className="!text-[14px]" />
    {label}: {yes ? "YES" : "NO"}
  </span>
);

export const Thumb = ({ src, className = "" }: { src: string; className?: string }) =>
  src ? (
    <img src={src} alt="" className={`object-cover rounded-lg border border-outline-variant ${className}`} />
  ) : (
    <div className={`flex items-center justify-center rounded-lg border border-outline-variant bg-surface-container-lowest text-outline ${className}`}>
      <Icon name="laptop_mac" />
    </div>
  );

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center text-center py-12 text-on-surface-variant gap-2">
      <Icon name={icon} className="!text-[40px] text-outline" />
      <div className="font-headline text-body-lg text-on-surface">{title}</div>
      {sub && <div className="text-body-sm max-w-[260px]">{sub}</div>}
    </div>
  );
}

export const ScreenHeader = ({ title, sub, onBack, right }: { title: ReactNode; sub?: ReactNode; onBack?: () => void; right?: ReactNode }) => (
  <header className="sticky top-0 z-30 bg-[#10245a]/70 backdrop-blur-xl border-b border-white/10 px-margin h-16 flex items-center gap-space-md">
    {onBack && <IconButton icon="arrow_back" label="Back" onClick={onBack} className="!border-transparent !bg-transparent" />}
    <div className="flex-1 min-w-0">
      <div className="font-headline text-headline-md leading-tight truncate">{title}</div>
      {sub && <div className="font-label text-label-sm text-on-surface-variant uppercase truncate">{sub}</div>}
    </div>
    {right}
  </header>
);
