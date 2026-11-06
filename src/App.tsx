import { useEffect, useState } from "react";
import { StoreProvider, describeSync, useStore } from "./store";
import { Icon, IconButton } from "./ui";
import Dashboard from "./screens/Dashboard";
import Intake from "./screens/Intake";
import JobDetail from "./screens/JobDetail";
import Handover from "./screens/Handover";
import Settings from "./screens/Settings";
import { Completed, Lookup } from "./screens/Lists";
import Dues from "./screens/Dues";
import Close from "./screens/Close";

const usePath = () => {
  const read = () => window.location.hash.replace(/^#/, "") || "/";
  const [path, setPath] = useState(read);
  useEffect(() => {
    const h = () => { setPath(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return [path, (p: string) => { window.location.hash = p; }] as const;
};

const NAV = [
  { path: "/", icon: "build", label: "Active Jobs" },
  { path: "/new", icon: "add_circle", label: "New Intake" },
  { path: "/done", icon: "task_alt", label: "Completed" },
  { path: "/search", icon: "search", label: "Lookup" },
];

function Shell() {
  const [path, go] = usePath();
  const { syncAll, syncing, pending, toast, notify, settings } = useStore();
  const nested = path.startsWith("/job/") || path.startsWith("/handover/") || path === "/settings" || path === "/dues" || path === "/close";

  let screen;
  if (path === "/new") screen = <Intake go={go} key="new" />;
  else if (path === "/done") screen = <Completed go={go} />;
  else if (path === "/search") screen = <Lookup go={go} />;
  else if (path === "/settings") screen = <Settings go={go} />;
  else if (path === "/dues") screen = <Dues go={go} />;
  else if (path === "/close") screen = <Close go={go} />;
  else if (path.startsWith("/job/")) screen = <JobDetail id={path.slice(5)} go={go} key={path} />;
  else if (path.startsWith("/handover/")) screen = <Handover id={path.slice(10)} go={go} key={path} />;
  else screen = <Dashboard go={go} />;

  const activeTab = path.startsWith("/job/") || path.startsWith("/handover/") ? "" : path;

  const doSync = async () => {
    if (!(settings.sheetUrl && settings.sheetSecret)) { go("/settings"); return; }
    const r = await syncAll();
    notify(describeSync(r), r.pullFailed || r.failed ? 8000 : 3200);
  };

  return (
    <div className="app-shell w-full max-w-[430px] mx-auto min-h-[100dvh] relative pb-24 sm:my-8 sm:min-h-[844px] sm:rounded-[36px] sm:shadow-[0_30px_80px_rgba(15,23,42,0.18)]">
      {!nested && (
        <header className="sticky top-0 z-40 h-16 px-margin flex items-center justify-between bg-[#163fa8]/55 backdrop-blur-xl border-b border-white/10">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Infizo" className="h-7 w-auto mix-blend-screen" />
          <div className="flex items-center gap-space-sm">
            <button onClick={doSync} aria-label="Sync with Google Sheets" className={`h-9 px-3 rounded-pill border flex items-center gap-1 font-label text-label-sm ${
              !(settings.sheetUrl && settings.sheetSecret) ? "border-white/20 text-on-surface-variant bg-white/5" : pending ? "border-amber text-amber bg-amber/10" : "border-white/15 text-white bg-white/10"}`}>
              <Icon name="sync" className={`!text-[16px] ${syncing ? "animate-spin" : ""}`} />
              {!(settings.sheetUrl && settings.sheetSecret) ? "Connect" : pending ? `${pending} pending` : "Synced"}
            </button>
            <IconButton icon="settings" label="Settings" onClick={() => go("/settings")} className="!w-9 !h-9 !border-white/15 !bg-white/10" />
          </div>
        </header>
      )}

      {screen}

      {toast && (
        <div role="status" className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-[398px] px-space-lg py-space-md rounded-pill glass text-body-md">
          {toast}
        </div>
      )}

      <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] max-w-[400px] h-[68px] z-40 grid grid-cols-4 rounded-pill glass px-1">
        {NAV.map((n) => {
          const on = activeTab === n.path;
          return (
            <button key={n.path} onClick={() => go(n.path)} className={`flex flex-col items-center justify-center gap-0.5 font-label text-label-sm rounded-pill transition-colors duration-100 ${on ? "text-white" : "text-on-surface-variant"}`}>
              <span className={`w-12 h-7 rounded-pill flex items-center justify-center ${on ? "bg-white/15" : ""}`}>
                <Icon name={n.icon} fill={on} />
              </span>
              {n.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  return <StoreProvider><Shell /></StoreProvider>;
}
