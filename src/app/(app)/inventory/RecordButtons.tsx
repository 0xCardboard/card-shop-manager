import Modal, { ModalSubmit } from "@/components/Modal";
import { money, toDateInput } from "@/lib/utils";
import { createPurchase } from "@/app/(app)/purchases/actions";
import { createSale } from "@/app/(app)/sales/actions";
import TradeForm from "@/app/(app)/trades/TradeForm";

type Item = { id: string; name: string; quantity: number; costBasis: number };

// The three "record an activity" buttons shown in the Inventory header. Each
// opens a popup with the same form that used to live on its own page.
export default function RecordButtons({
  purchaseItems,
  saleItems,
  customers,
  tradeItems,
}: {
  purchaseItems: { id: string; name: string; quantity: number }[];
  saleItems: Item[];
  customers: { id: string; name: string }[];
  tradeItems: Item[];
}) {
  return (
    <>
      <Modal triggerLabel="+ Purchase" title="Log a purchase">
        <form action={createPurchase} className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input name="date" type="date" defaultValue={toDateInput(new Date())} className="input" />
          </div>
          <div>
            <label className="label">Item name</label>
            <input name="itemName" required className="input" />
          </div>
          <div>
            <label className="label">Source</label>
            <input name="source" className="input" placeholder="eBay, show…" />
          </div>
          <div>
            <label className="label">Location</label>
            <select name="location" className="input" defaultValue="BRAZIL">
              <option value="BRAZIL">Brazil</option>
              <option value="US">US</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input name="quantity" type="number" defaultValue="1" className="input" />
          </div>
          <div>
            <label className="label">Cost / unit</label>
            <input name="unitCost" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Fees</label>
            <input name="fees" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Shipping</label>
            <input name="shipping" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Link to existing inventory item (optional)</label>
            <select name="inventoryItemId" className="input">
              <option value="">— none —</option>
              {purchaseItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.quantity} in stock)
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" name="addToInventory" defaultChecked />
              If not linked, create a new inventory item
            </label>
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <input name="notes" className="input" />
          </div>
          <div className="col-span-2">
            <ModalSubmit>Log purchase</ModalSubmit>
          </div>
        </form>
      </Modal>

      <Modal triggerLabel="+ Sale" title="Record a sale">
        <form action={createSale} className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input name="date" type="date" defaultValue={toDateInput(new Date())} className="input" />
          </div>
          <div>
            <label className="label">Platform</label>
            <input name="platform" className="input" placeholder="eBay, Whatnot…" />
          </div>
          <div className="col-span-2">
            <label className="label">Item sold</label>
            <select name="inventoryItemId" className="input">
              <option value="">— not from inventory —</option>
              {saleItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.quantity} left · cost {money(i.costBasis)})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              Only items in US inventory can be sold. Ship items from Brazil first.
            </p>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input name="quantity" type="number" defaultValue="1" className="input" />
          </div>
          <div>
            <label className="label">Sale price (total)</label>
            <input name="salePrice" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Fees</label>
            <input name="fees" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div>
            <label className="label">Shipping cost</label>
            <input name="shipping" type="number" step="0.01" defaultValue="0" className="input" />
          </div>
          <div className="col-span-2">
            <label className="label">Customer (optional)</label>
            <select name="customerId" className="input">
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
            <input name="notes" className="input" />
          </div>
          <div className="col-span-2">
            <ModalSubmit>Record sale</ModalSubmit>
          </div>
        </form>
      </Modal>

      <Modal triggerLabel="+ Trade" title="Log a trade">
        <TradeForm items={tradeItems} />
      </Modal>
    </>
  );
}
