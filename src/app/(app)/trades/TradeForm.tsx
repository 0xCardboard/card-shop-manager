"use client";

import { useMemo, useState } from "react";
import { ModalSubmit } from "@/components/Modal";
import { money, toDateInput } from "@/lib/utils";
import { createTrade } from "./actions";

type Item = { id: string; name: string; quantity: number; costBasis: number };
type GivenRow = { key: number; id: string; qty: number };
type RecvRow = { key: number; name: string; qty: number; value: number };

let counter = 1;
const nextKey = () => counter++;

export default function TradeForm({ items }: { items: Item[] }) {
  const [given, setGiven] = useState<GivenRow[]>([
    { key: nextKey(), id: "", qty: 1 },
  ]);
  const [received, setReceived] = useState<RecvRow[]>([
    { key: nextKey(), name: "", qty: 1, value: 0 },
  ]);
  const [cashOut, setCashOut] = useState(0);
  const [cashIn, setCashIn] = useState(0);

  const itemById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );

  // Live cost-basis preview that mirrors the server math.
  const preview = useMemo(() => {
    const givenBasis = given.reduce((s, g) => {
      const item = itemById.get(g.id);
      return s + (item ? Math.max(0, g.qty) * item.costBasis : 0);
    }, 0);
    const receivedBasis = Math.max(0, givenBasis + cashOut - cashIn);
    const totalValue = received.reduce((s, r) => s + Math.max(0, r.value), 0);
    const totalQty = received.reduce((s, r) => s + Math.max(0, r.qty), 0);
    const rows = received.map((r) => {
      const weight =
        totalValue > 0
          ? Math.max(0, r.value) / totalValue
          : totalQty > 0
          ? Math.max(0, r.qty) / totalQty
          : 0;
      const basis = receivedBasis * weight;
      return {
        key: r.key,
        name: r.name || "(unnamed item)",
        qty: r.qty,
        basis,
        unit: r.qty > 0 ? basis / r.qty : 0,
      };
    });
    return { givenBasis, receivedBasis, rows };
  }, [given, received, cashOut, cashIn, itemById]);

  return (
    <form action={createTrade} className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="label">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={toDateInput(new Date())}
            className="input"
          />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <label className="label">Traded with (optional)</label>
          <input name="counterparty" className="input" placeholder="Name / shop" />
        </div>
      </div>

      {/* Items given */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          You give (from inventory)
        </h3>
        <div className="space-y-2">
          {given.map((row) => {
            const item = itemById.get(row.id);
            return (
              <div key={row.key} className="grid grid-cols-12 gap-2">
                <select
                  name="givenId"
                  value={row.id}
                  onChange={(e) =>
                    setGiven((rows) =>
                      rows.map((r) =>
                        r.key === row.key ? { ...r, id: e.target.value } : r
                      )
                    )
                  }
                  className="input col-span-7"
                >
                  <option value="">— select an item —</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.quantity} @ {money(i.costBasis)})
                    </option>
                  ))}
                </select>
                <input
                  name="givenQty"
                  type="number"
                  min={1}
                  max={item?.quantity}
                  value={row.qty}
                  onChange={(e) =>
                    setGiven((rows) =>
                      rows.map((r) =>
                        r.key === row.key
                          ? { ...r, qty: Number(e.target.value) }
                          : r
                      )
                    )
                  }
                  className="input col-span-3"
                  placeholder="Qty"
                />
                <button
                  type="button"
                  onClick={() =>
                    setGiven((rows) =>
                      rows.length > 1
                        ? rows.filter((r) => r.key !== row.key)
                        : rows
                    )
                  }
                  className="btn-secondary col-span-2 py-1 text-xs"
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() =>
            setGiven((rows) => [...rows, { key: nextKey(), id: "", qty: 1 }])
          }
          className="btn-secondary mt-2 py-1 text-xs"
        >
          + Add item to give
        </button>
      </section>

      {/* Cash */}
      <section className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Cash you pay (optional)</label>
          <input
            name="cashOut"
            type="number"
            step="0.01"
            min={0}
            value={cashOut || ""}
            onChange={(e) => setCashOut(Number(e.target.value))}
            className="input"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="label">Cash you receive (optional)</label>
          <input
            name="cashIn"
            type="number"
            step="0.01"
            min={0}
            value={cashIn || ""}
            onChange={(e) => setCashIn(Number(e.target.value))}
            className="input"
            placeholder="0.00"
          />
        </div>
      </section>

      {/* Items received */}
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">
          You receive (added to inventory)
        </h3>
        <p className="mb-2 text-xs text-slate-400">
          Estimated value is only used to split the cost basis across multiple
          items. With one item, or if left blank, the basis splits evenly.
        </p>
        <div className="space-y-2">
          {received.map((row) => (
            <div key={row.key} className="grid grid-cols-12 gap-2">
              <input
                name="receivedName"
                value={row.name}
                onChange={(e) =>
                  setReceived((rows) =>
                    rows.map((r) =>
                      r.key === row.key ? { ...r, name: e.target.value } : r
                    )
                  )
                }
                className="input col-span-6"
                placeholder="Card / item name"
              />
              <input
                name="receivedQty"
                type="number"
                min={1}
                value={row.qty}
                onChange={(e) =>
                  setReceived((rows) =>
                    rows.map((r) =>
                      r.key === row.key
                        ? { ...r, qty: Number(e.target.value) }
                        : r
                    )
                  )
                }
                className="input col-span-2"
                placeholder="Qty"
              />
              <input
                name="receivedValue"
                type="number"
                step="0.01"
                min={0}
                value={row.value || ""}
                onChange={(e) =>
                  setReceived((rows) =>
                    rows.map((r) =>
                      r.key === row.key
                        ? { ...r, value: Number(e.target.value) }
                        : r
                    )
                  )
                }
                className="input col-span-2"
                placeholder="Est. $"
              />
              <button
                type="button"
                onClick={() =>
                  setReceived((rows) =>
                    rows.length > 1
                      ? rows.filter((r) => r.key !== row.key)
                      : rows
                  )
                }
                className="btn-secondary col-span-2 py-1 text-xs"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setReceived((rows) => [
              ...rows,
              { key: nextKey(), name: "", qty: 1, value: 0 },
            ])
          }
          className="btn-secondary mt-2 py-1 text-xs"
        >
          + Add item received
        </button>
      </section>

      {/* Live preview */}
      <div className="rounded-lg bg-slate-50 p-4 text-sm">
        <div className="mb-2 flex flex-wrap gap-x-6 gap-y-1 text-slate-600">
          <span>
            Basis given: <strong>{money(preview.givenBasis)}</strong>
          </span>
          <span>+ cash paid: {money(cashOut)}</span>
          <span>− cash received: {money(cashIn)}</span>
          <span className="text-slate-900">
            = basis passed on: <strong>{money(preview.receivedBasis)}</strong>
          </span>
        </div>
        <ul className="space-y-0.5 text-slate-500">
          {preview.rows.map((r) => (
            <li key={r.key}>
              {r.name}: {money(r.basis)} total
              {r.qty > 1 ? ` (${money(r.unit)} each)` : ""}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="label">Notes (optional)</label>
          <input name="notes" className="input" />
        </div>
      </div>

      <ModalSubmit>Log trade</ModalSubmit>
    </form>
  );
}
