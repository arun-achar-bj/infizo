import { useState } from "react";
import { describeSync, useStore } from "../store";
import { Button, Card, CardTitle, Field, ScreenHeader } from "../ui";
import { SHEET_COLUMNS } from "../types";
import { isValidSheetUrl, pingSheet, pullRows } from "../lib/sheets";

export default function Settings({ go }: { go: (p: string) => void }) {
  const { settings, setSettings, syncAll, syncing, pending, clearAll, notify, jobs } = useStore();
  const [s, setS] = useState(settings);

  const urlOk = !s.sheetUrl.trim() || isValidSheetUrl(s.sheetUrl);
  const clean = () => ({ ...s, sheetUrl: s.sheetUrl.trim(), sheetSecret: s.sheetSecret.trim() });
  const save = () => {
    if (!urlOk) { notify("URL must be https://script.google.com/macros/s/…/exec"); return false; }
    setSettings(clean()); notify("Settings saved"); return true;
  };
  const test = async () => {
    const r = await pingSheet(s.sheetUrl, s.sheetSecret.trim());
    if (r === "ok") {
      try { const d = await pullRows(s.sheetUrl, s.sheetSecret.trim()); notify(d.sheet ? `Connected ✓ — tab “${d.sheet}” has ${d.rows.length} ticket${d.rows.length === 1 ? "" : "s"}` : `Connected, ${d.rows.length} ticket${d.rows.length === 1 ? "" : "s"} found — but the script is an OLD version. Paste the latest Code.gs and Deploy → New version.`, d.sheet ? 3200 : 9000); }
      catch (e) { notify(e instanceof Error ? e.message : "Connected, but couldn't read the Sheet"); }
      return;
    }
    notify(r === "unauthorized" ? "Reached the script, but the secret is wrong" : r === "bad_url" ? "URL must be https://script.google.com/macros/s/…/exec" : "Could not reach that URL — check deployment access is “Anyone”");
  };

  return (
    <div className="pb-8">
      <ScreenHeader title="Settings" sub="Google Sheets · shop" onBack={() => go("/")} />
      <div className="px-margin py-space-lg flex flex-col gap-space-lg">
        <Card>
          <CardTitle icon="table_view" hint={pending ? `${pending} unsynced` : "All synced"} hintClass={pending ? "text-amber" : "text-tertiary"}>Google Sheet</CardTitle>
          <Field label="Apps Script web app URL" icon="link" mono value={s.sheetUrl} onChange={(e) => setS({ ...s, sheetUrl: e.target.value })} placeholder="https://script.google.com/macros/s/…/exec" autoCapitalize="off" className={urlOk ? "" : "[&>div]:!border-error"} />
          <Field className="mt-space-md" label="Shared secret" icon="key" mono type="password" value={s.sheetSecret} onChange={(e) => setS({ ...s, sheetSecret: e.target.value })} placeholder="From Code.gs → setup() log" autoCapitalize="off" autoComplete="off" />
          <p className="text-body-sm text-on-surface-variant mt-space-sm">
            Paste <b>apps-script/Code.gs</b> into your Sheet's Apps Script editor, run <code>setup()</code>, copy the secret it logs, then deploy as a Web app (access: Anyone — requests are rejected without the secret). Each ticket becomes one row, updated in place on every status change.
          </p>
          <div className="grid grid-cols-2 gap-space-sm mt-space-md">
            <Button variant="secondary" onClick={test} disabled={!s.sheetUrl.trim() || !s.sheetSecret.trim()}>Test</Button>
            <Button variant="secondary" icon="sync" busy={syncing} onClick={async () => { if (!save()) return; await new Promise((r) => setTimeout(r, 50)); const r = await syncAll(); notify(describeSync(r)); }}>Sync all</Button>
          </div>
        </Card>

        <Card>
          <CardTitle icon="store">Shop</CardTitle>
          <div className="flex flex-col gap-space-md">
            <Field label="Shop name" value={s.shopName} onChange={(e) => setS({ ...s, shopName: e.target.value })} />
            <Field label="Shop phone (on invoices)" type="tel" value={s.shopPhone} onChange={(e) => setS({ ...s, shopPhone: e.target.value })} />
            <Field label="Default technician" value={s.technician} onChange={(e) => setS({ ...s, technician: e.target.value })} />
          </div>
        </Card>

        <Button onClick={save} icon="save">Save settings</Button>

        <Card>
          <CardTitle icon="view_column">Sheet columns</CardTitle>
          <p className="font-label text-label-sm text-on-surface-variant leading-5 break-words">{SHEET_COLUMNS.join(" · ")}</p>
        </Card>

        <Button variant="danger" icon="delete" onClick={() => { if (confirm(`Remove the ${jobs.length} tickets cached on this device? Everything already in the Sheet reloads on the next sync. ${pending ? pending + " not yet synced will be lost." : ""}`)) { clearAll(); notify("Local data cleared"); } }}>Clear cached data on this device</Button>
      </div>
    </div>
  );
}
