import { collectedOn, dayClose } from "../lib/desk";
import { inr } from "../lib/format";
import { useStore } from "../store";
import { EmptyState, ScreenHeader } from "../ui";

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="glass rounded-xl p-4">
    <div className="font-label text-label-sm text-white/70">{label}</div>
    <div className="font-headline text-headline-md text-white mt-1">{value}</div>
  </div>
);

export default function Close({ go }: { go: (p: string) => void }) {
  const { jobs } = useStore();
  const { takenIn, delivered, collected, outstanding } = dayClose(jobs);
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="pb-28">
      <ScreenHeader title="Today" sub={today} onBack={() => go("/")} />
      <div className="px-margin py-space-lg flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Taken in" value={String(takenIn.length)} />
          <Stat label="Delivered" value={String(delivered.length)} />
          <Stat label="Collected on those deliveries" value={inr(collected)} />
          <Stat label="Still outstanding" value={inr(outstanding)} />
        </div>
        <section className="mt-2">
          <h2 className="font-headline text-body-lg mb-2">Came in today</h2>
          {takenIn.length === 0 && <EmptyState icon="inbox" title="No intakes today" />}
          {takenIn.map((j) => (
            <button key={j.id} type="button" onClick={() => go(`/job/${j.id}`)} className="glass rounded-xl p-4 mb-2 w-full text-left">
              <div className="font-headline text-body-md">{j.name}</div>
              <div className="font-label text-label-md text-white/70">{j.id} · {j.model}</div>
            </button>
          ))}
        </section>
        <section>
          <h2 className="font-headline text-body-lg mb-2">Handed over today</h2>
          {delivered.length === 0 && <EmptyState icon="inventory_2" title="No handovers today" />}
          {delivered.map((j) => (
            <button key={j.id} type="button" onClick={() => go(`/job/${j.id}`)} className="glass rounded-xl p-4 mb-2 w-full text-left">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-headline text-body-md">{j.name}</div>
                  <div className="font-label text-label-md text-white/70">{j.id} · {j.payment}</div>
                </div>
                <div className="font-headline text-body-md">{inr(collectedOn(j))}</div>
              </div>
            </button>
          ))}
        </section>
      </div>
    </div>
  );
}
