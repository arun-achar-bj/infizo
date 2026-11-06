import { owing, reminderMessage } from "../lib/desk";
import { inr, waLink } from "../lib/format";
import { useStore } from "../store";
import { EmptyState, Icon, ScreenHeader } from "../ui";

export default function Dues({ go }: { go: (p: string) => void }) {
  const { jobs, settings } = useStore();
  const rows = owing(jobs);
  const total = rows.reduce((s, x) => s + x.due, 0);

  return (
    <div className="pb-28">
      <ScreenHeader title="Outstanding" sub={`${rows.length} open`} onBack={() => go("/")} />
      <div className="px-margin py-space-lg flex flex-col gap-3">
        <div className="glass rounded-xl p-space-lg">
          <div className="font-label text-label-md text-white/70">Still to collect</div>
          <div className="font-headline text-headline-xl-mobile text-white mt-1">{inr(total)}</div>
        </div>
        {rows.length === 0 && <EmptyState icon="check_circle" title="Nothing outstanding" sub="Every ticket with an amount is marked fully paid." />}
        {rows.map(({ job, due }) => (
          <article key={job.id} className="glass rounded-xl p-4">
            <button type="button" onClick={() => go(`/job/${job.id}`)} className="w-full text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-headline text-body-lg">{job.name}</div>
                  <div className="font-label text-label-md text-white/70 mt-0.5 truncate">{job.id} · {job.model}</div>
                </div>
                <div className="font-headline text-body-lg text-error shrink-0">{inr(due)}</div>
              </div>
              <div className="font-label text-label-sm text-white/60 mt-2">{job.status} · {job.payment}</div>
            </button>
            <a
              href={waLink(job.phone, reminderMessage(job, settings.shopName, due))}
              target="_blank"
              rel="noreferrer"
              className="mt-3 h-11 rounded-pill border border-tertiary/50 text-tertiary flex items-center justify-center gap-2 font-label text-label-md"
            >
              <Icon name="chat" className="!text-[18px]" />
              Remind on WhatsApp
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
