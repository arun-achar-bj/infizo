import { useState } from "react";
import { JobCard, SearchBar, matches } from "../components";
import { useStore } from "../store";
import { EmptyState } from "../ui";

export function Completed({ go }: { go: (p: string) => void }) {
  const { jobs } = useStore();
  const [q, setQ] = useState("");
  const list = jobs
    .filter((j) => j.status === "Delivered" && matches(j, q))
    .sort((a, b) => +new Date(b.dateDelivered || b.dateIn) - +new Date(a.dateDelivered || a.dateIn));
  return (
    <div className="px-margin py-space-xl flex flex-col gap-space-lg">
      <div>
        <h1 className="font-headline text-headline-xl-mobile text-white">Completed</h1>
        <div className="font-body text-body-md text-white/70 mt-2">{list.length} delivered</div>
      </div>
      <SearchBar value={q} onChange={setQ} />
      <div className="flex flex-col gap-space-md">
        {list.map((j) => <JobCard key={j.id} job={j} onOpen={() => go(`/job/${j.id}`)} />)}
        {list.length === 0 && <EmptyState icon="inventory_2" title="Nothing delivered yet" sub="Jobs move here after the customer handover is completed." />}
      </div>
    </div>
  );
}

export function Lookup({ go }: { go: (p: string) => void }) {
  const { jobs } = useStore();
  const [q, setQ] = useState("");
  const list = jobs.filter((j) => matches(j, q)).sort((a, b) => +new Date(b.dateIn) - +new Date(a.dateIn));
  return (
    <div className="px-margin py-space-xl flex flex-col gap-space-lg">
      <div>
        <h1 className="font-headline text-headline-xl-mobile text-white">Lookup</h1>
        <div className="font-body text-body-md text-white/70 mt-2">Ticket, name, phone, or model</div>
      </div>
      <div className="sticky top-16 z-20 py-1">
        <SearchBar value={q} onChange={setQ} placeholder="Search all tickets…" />
      </div>
      <div className="flex flex-col gap-space-md">
        {list.map((j) => <JobCard key={j.id} job={j} onOpen={() => go(`/job/${j.id}`)} />)}
        {list.length === 0 && <EmptyState icon="search_off" title="No tickets found" sub="Check the spelling or try the last 4 digits of the phone." />}
      </div>
    </div>
  );
}
