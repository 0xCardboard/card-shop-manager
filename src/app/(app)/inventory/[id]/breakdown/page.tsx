import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { money } from "@/lib/utils";
import { breakDownItem } from "../../actions";

export default async function BreakdownPage({
  params,
}: {
  params: { id: string };
}) {
  await requireSession();
  const parent = await prisma.inventoryItem.findUnique({
    where: { id: params.id },
  });
  if (!parent) notFound();

  const others = await prisma.inventoryItem.findMany({
    where: { id: { not: parent.id } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader title="Break down item" subtitle={parent.name}>
        <Link href="/inventory" className="btn-secondary">
          Back
        </Link>
      </PageHeader>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="mb-2">
          Split a sealed/bulk item into smaller units. Example: open{" "}
          <strong>1 case</strong> (cost {money(parent.costBasis)}) into{" "}
          <strong>10 booster boxes</strong> → each box gets a cost basis of{" "}
          {money(parent.costBasis / 10)}.
        </p>
        <p>
          The consumed cost is split evenly across the new units, so your total
          inventory value and future profit math stay exactly correct. Currently
          in stock: <strong>{parent.quantity}</strong> @{" "}
          {money(parent.costBasis)} each.
        </p>
      </div>

      <form action={breakDownItem} className="card space-y-5 p-5">
        <input type="hidden" name="parentId" value={parent.id} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <label className="label">Units of this item to open</label>
            <input
              name="parentQty"
              type="number"
              min={1}
              max={parent.quantity}
              defaultValue={1}
              className="input"
            />
          </div>
          <div>
            <label className="label">Number of units produced</label>
            <input
              name="childQty"
              type="number"
              min={1}
              defaultValue={10}
              className="input"
            />
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Where do the new units go?
          </p>

          <div className="mb-4">
            <label className="label">
              Option A — merge into an existing item
            </label>
            <select name="targetId" className="input">
              <option value="">— don&apos;t merge; create new (Option B) —</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} ({o.quantity} in stock @ {money(o.costBasis)})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Uses weighted-average cost if the item already has stock.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Option B — new item name</label>
              <input
                name="childName"
                className="input"
                placeholder="e.g. Booster box"
              />
            </div>
            <div>
              <label className="label">Set (optional)</label>
              <input
                name="childSet"
                className="input"
                defaultValue={parent.setName ?? ""}
              />
            </div>
            <div>
              <label className="label">Condition (optional)</label>
              <input name="childCondition" className="input" placeholder="Sealed" />
            </div>
          </div>
        </div>

        <button className="btn-primary" type="submit">
          Break down
        </button>
      </form>
    </div>
  );
}
