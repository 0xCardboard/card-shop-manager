import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { toDateInput } from "@/lib/utils";
import { updateItem } from "../../actions";

const STATUS_OPTS = [
  { value: "IN_STOCK", label: "In stock" },
  { value: "LISTED", label: "Listed" },
  { value: "RESERVED", label: "Reserved" },
  { value: "SOLD", label: "Sold" },
];

export default async function EditInventoryPage({
  params,
}: {
  params: { id: string };
}) {
  await requireSession();
  const item = await prisma.inventoryItem.findUnique({
    where: { id: params.id },
  });
  if (!item) notFound();

  return (
    <div>
      <PageHeader title="Edit item" subtitle={item.name}>
        <Link href="/inventory" className="btn-secondary">
          Back
        </Link>
      </PageHeader>

      <form
        action={updateItem}
        className="card grid grid-cols-2 gap-3 p-5 sm:grid-cols-4"
      >
        <input type="hidden" name="id" value={item.id} />
        <F label="Card name" name="name" defaultValue={item.name} required full />
        <F label="Set" name="setName" defaultValue={item.setName} />
        <F label="Year" name="year" type="number" defaultValue={item.year?.toString()} />
        <F label="Card #" name="cardNumber" defaultValue={item.cardNumber} />
        <F label="Condition" name="condition" defaultValue={item.condition} />
        <div>
          <label className="label">Graded?</label>
          <label className="flex items-center gap-2 py-2 text-sm">
            <input type="checkbox" name="graded" defaultChecked={item.graded} />{" "}
            Graded
          </label>
        </div>
        <F label="Grader" name="gradingCompany" defaultValue={item.gradingCompany} />
        <F label="Grade" name="grade" defaultValue={item.grade} />
        <F label="Cert #" name="certNumber" defaultValue={item.certNumber} />
        <F label="SKU" name="sku" defaultValue={item.sku} />
        <div>
          <label className="label">Internal SKU</label>
          <input
            value={item.internalSku ?? "—"}
            readOnly
            className="input bg-slate-50 font-mono text-xs text-slate-500"
          />
        </div>
        <F label="Quantity" name="quantity" type="number" defaultValue={item.quantity.toString()} />
        <F label="Cost / unit" name="costBasis" type="number" step="0.01" defaultValue={item.costBasis.toString()} />
        <F label="Acquired" name="acquisitionDate" type="date" defaultValue={toDateInput(item.acquisitionDate)} />
        <div>
          <label className="label">Status</label>
          <select name="status" className="input" defaultValue={item.status}>
            {STATUS_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Location</label>
          <select name="location" className="input" defaultValue={item.location}>
            <option value="BRAZIL">Brazil</option>
            <option value="US">US</option>
          </select>
        </div>
        <F label="Notes" name="notes" defaultValue={item.notes} full />
        <div className="col-span-2 sm:col-span-4">
          <button className="btn-primary" type="submit">
            Save changes
          </button>
        </div>
      </form>
    </div>
  );
}

function F({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  full,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  required?: boolean;
  full?: boolean;
  step?: string;
}) {
  return (
    <div className={full ? "col-span-2 sm:col-span-4" : ""}>
      <label className="label">{label}</label>
      <input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="input"
      />
    </div>
  );
}
