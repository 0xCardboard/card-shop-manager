import PageHeader from "@/components/PageHeader";
import Modal from "@/components/Modal";
import FilterBar from "@/components/FilterBar";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { fmtDate, money } from "@/lib/utils";
import TradeForm from "./TradeForm";
import { deleteTrade } from "./actions";

export default async function TradesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireSession();
  const q = (searchParams.q ?? "").trim();

  const where = q
    ? {
        OR: [
          { counterparty: { contains: q, mode: "insensitive" as const } },
          { notes: { contains: q, mode: "insensitive" as const } },
          {
            legs: {
              some: { itemName: { contains: q, mode: "insensitive" as const } },
            },
          },
        ],
      }
    : {};

  const [items, trades] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { quantity: { gt: 0 } },
      orderBy: { name: "asc" },
    }),
    prisma.trade.findMany({
      where,
      orderBy: { date: "desc" },
      include: { legs: true },
      take: 100,
    }),
  ]);

  const formItems = items.map((i) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity,
    costBasis: i.costBasis,
  }));

  return (
    <div>
      <PageHeader
        title="Trades"
        subtitle="Swap items for items (plus cash). Cost basis passes through to what you receive."
      >
        <Modal triggerLabel="+ Log trade" title="Log a trade">
          <TradeForm items={formItems} />
        </Modal>
      </PageHeader>

      <FilterBar
        action="/trades"
        q={q}
        placeholder="Search counterparty, item, notes…"
        clearHref="/trades"
      />

      <div className="space-y-3">
        {trades.length === 0 && (
          <div className="card p-6 text-center text-slate-400">
            No trades logged yet.
          </div>
        )}
        {trades.map((t) => {
          const gave = t.legs.filter((l) => l.direction === "GAVE");
          const received = t.legs.filter((l) => l.direction === "RECEIVED");
          return (
            <div key={t.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {fmtDate(t.date)}
                    {t.counterparty ? ` · ${t.counterparty}` : ""}
                  </div>
                  {t.notes && (
                    <div className="text-xs text-slate-500">{t.notes}</div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {t.realizedGain > 0 && (
                    <span className="badge bg-emerald-100 text-emerald-700">
                      Gain {money(t.realizedGain)}
                    </span>
                  )}
                  <form action={deleteTrade}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="btn-danger py-1 text-xs">Delete</button>
                  </form>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Gave
                  </div>
                  <ul className="space-y-0.5 text-sm text-slate-700">
                    {gave.map((l) => (
                      <li key={l.id}>
                        {l.quantity}× {l.itemName}{" "}
                        <span className="text-slate-400">
                          ({money(l.basis)} basis)
                        </span>
                      </li>
                    ))}
                    {t.cashOut > 0 && (
                      <li className="text-slate-700">
                        Cash paid: {money(t.cashOut)}
                      </li>
                    )}
                    {gave.length === 0 && t.cashOut === 0 && (
                      <li className="text-slate-400">—</li>
                    )}
                  </ul>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Received
                  </div>
                  <ul className="space-y-0.5 text-sm text-slate-700">
                    {received.map((l) => (
                      <li key={l.id}>
                        {l.quantity}× {l.itemName}{" "}
                        <span className="text-slate-400">
                          ({money(l.basis)} basis)
                        </span>
                      </li>
                    ))}
                    {t.cashIn > 0 && (
                      <li className="text-slate-700">
                        Cash received: {money(t.cashIn)}
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
