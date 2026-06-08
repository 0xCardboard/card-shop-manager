import Modal, { ModalSubmit } from "@/components/Modal";
import { toDateInput } from "@/lib/utils";
import { updatePurchase } from "@/app/(app)/purchases/actions";
import { updateSale } from "@/app/(app)/sales/actions";
import { updateTrade } from "@/app/(app)/trades/actions";
import { updateShipment } from "@/app/(app)/inventory/actions";

const TRIGGER = "btn-secondary py-1 text-xs";

export function EditPurchase({
  purchase,
}: {
  purchase: {
    id: string;
    date: Date;
    source: string | null;
    itemName: string;
    quantity: number;
    unitCost: number;
    fees: number;
    shipping: number;
    notes: string | null;
  };
}) {
  return (
    <Modal triggerLabel="Edit" triggerClassName={TRIGGER} title="Edit purchase">
      <form action={updatePurchase} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={purchase.id} />
        <div>
          <label className="label">Date</label>
          <input name="date" type="date" defaultValue={toDateInput(purchase.date)} className="input" />
        </div>
        <div>
          <label className="label">Source</label>
          <input name="source" defaultValue={purchase.source ?? ""} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Item name</label>
          <input name="itemName" defaultValue={purchase.itemName} required className="input" />
        </div>
        <div>
          <label className="label">Fees</label>
          <input name="fees" type="number" step="0.01" defaultValue={purchase.fees} className="input" />
        </div>
        <div>
          <label className="label">Shipping</label>
          <input name="shipping" type="number" step="0.01" defaultValue={purchase.shipping} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <input name="notes" defaultValue={purchase.notes ?? ""} className="input" />
        </div>
        <p className="col-span-2 text-xs text-slate-400">
          Quantity ({purchase.quantity}) and unit cost are locked because they
          set the linked item&apos;s cost basis — delete &amp; re-add to change them.
        </p>
        <div className="col-span-2">
          <ModalSubmit>Save changes</ModalSubmit>
        </div>
      </form>
    </Modal>
  );
}

export function EditSale({
  sale,
  customers,
}: {
  sale: {
    id: string;
    date: Date;
    quantity: number;
    salePrice: number;
    fees: number;
    shipping: number;
    platform: string | null;
    customerId: string | null;
    notes: string | null;
  };
  customers: { id: string; name: string }[];
}) {
  return (
    <Modal triggerLabel="Edit" triggerClassName={TRIGGER} title="Edit sale">
      <form action={updateSale} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={sale.id} />
        <div>
          <label className="label">Date</label>
          <input name="date" type="date" defaultValue={toDateInput(sale.date)} className="input" />
        </div>
        <div>
          <label className="label">Platform</label>
          <input name="platform" defaultValue={sale.platform ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Quantity</label>
          <input name="quantity" type="number" defaultValue={sale.quantity} className="input" />
        </div>
        <div>
          <label className="label">Sale price (total)</label>
          <input name="salePrice" type="number" step="0.01" defaultValue={sale.salePrice} className="input" />
        </div>
        <div>
          <label className="label">Fees</label>
          <input name="fees" type="number" step="0.01" defaultValue={sale.fees} className="input" />
        </div>
        <div>
          <label className="label">Shipping cost</label>
          <input name="shipping" type="number" step="0.01" defaultValue={sale.shipping} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Customer</label>
          <select name="customerId" className="input" defaultValue={sale.customerId ?? ""}>
            <option value="">— none —</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <input name="notes" defaultValue={sale.notes ?? ""} className="input" />
        </div>
        <p className="col-span-2 text-xs text-slate-400">
          Changing quantity returns the old units to stock and deducts the new
          amount; profit is recomputed from the item&apos;s current cost.
        </p>
        <div className="col-span-2">
          <ModalSubmit>Save changes</ModalSubmit>
        </div>
      </form>
    </Modal>
  );
}

export function EditTrade({
  trade,
}: {
  trade: {
    id: string;
    date: Date;
    counterparty: string | null;
    notes: string | null;
  };
}) {
  return (
    <Modal triggerLabel="Edit" triggerClassName={TRIGGER} title="Edit trade">
      <form action={updateTrade} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={trade.id} />
        <div>
          <label className="label">Date</label>
          <input name="date" type="date" defaultValue={toDateInput(trade.date)} className="input" />
        </div>
        <div>
          <label className="label">Traded with</label>
          <input name="counterparty" defaultValue={trade.counterparty ?? ""} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <input name="notes" defaultValue={trade.notes ?? ""} className="input" />
        </div>
        <p className="col-span-2 text-xs text-slate-400">
          The traded items and cash set the cost-basis pass-through — delete &amp;
          re-add the trade to change those.
        </p>
        <div className="col-span-2">
          <ModalSubmit>Save changes</ModalSubmit>
        </div>
      </form>
    </Modal>
  );
}

export function EditShipment({
  shipment,
}: {
  shipment: {
    id: string;
    date: Date;
    reference: string | null;
    shipping: number;
    tariffs: number;
    fees: number;
    notes: string | null;
  };
}) {
  return (
    <Modal triggerLabel="Edit" triggerClassName={TRIGGER} title="Edit shipment">
      <form action={updateShipment} className="grid grid-cols-2 gap-3">
        <input type="hidden" name="id" value={shipment.id} />
        <div>
          <label className="label">Date</label>
          <input name="date" type="date" defaultValue={toDateInput(shipment.date)} className="input" />
        </div>
        <div>
          <label className="label">Reference</label>
          <input name="reference" defaultValue={shipment.reference ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Shipping cost</label>
          <input name="shipping" type="number" step="0.01" defaultValue={shipment.shipping} className="input" />
        </div>
        <div>
          <label className="label">Tariffs / duties</label>
          <input name="tariffs" type="number" step="0.01" defaultValue={shipment.tariffs} className="input" />
        </div>
        <div>
          <label className="label">Other fees</label>
          <input name="fees" type="number" step="0.01" defaultValue={shipment.fees} className="input" />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <input name="notes" defaultValue={shipment.notes ?? ""} className="input" />
        </div>
        <p className="col-span-2 text-xs text-slate-400">
          Changing costs re-distributes the landed cost across the shipped items
          and adjusts the cost basis of those still in US stock.
        </p>
        <div className="col-span-2">
          <ModalSubmit>Save changes</ModalSubmit>
        </div>
      </form>
    </Modal>
  );
}
