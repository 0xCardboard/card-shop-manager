import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isoDate, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

type ExportType =
  | "inventory"
  | "purchases"
  | "sales"
  | "expenses"
  | "customers"
  | "leads";

export async function GET(
  _req: Request,
  { params }: { params: { type: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const type = params.type as ExportType;
  let headers: string[] = [];
  let rows: unknown[][] = [];

  switch (type) {
    case "inventory": {
      const items = await prisma.inventoryItem.findMany({
        orderBy: { createdAt: "desc" },
      });
      headers = [
        "Name", "Set", "Year", "Card #", "Condition", "Graded",
        "Grader", "Grade", "Cert #", "SKU", "Internal SKU", "Quantity",
        "Cost/unit", "Total cost", "Status", "Acquired", "Notes",
      ];
      rows = items.map((i) => [
        i.name, i.setName, i.year, i.cardNumber, i.condition,
        i.graded ? "Yes" : "No", i.gradingCompany, i.grade, i.certNumber,
        i.sku, i.internalSku, i.quantity, i.costBasis.toFixed(2),
        (i.quantity * i.costBasis).toFixed(2), i.status,
        isoDate(i.acquisitionDate), i.notes,
      ]);
      break;
    }
    case "purchases": {
      const purchases = await prisma.purchase.findMany({
        orderBy: { date: "desc" },
        include: { inventoryItem: true },
      });
      headers = [
        "Date", "Item", "Source", "Quantity", "Unit cost", "Fees",
        "Shipping", "Total", "Linked item", "Notes",
      ];
      rows = purchases.map((p) => [
        isoDate(p.date), p.itemName, p.source, p.quantity,
        p.unitCost.toFixed(2), p.fees.toFixed(2), p.shipping.toFixed(2),
        p.total.toFixed(2), p.inventoryItem?.name ?? "", p.notes,
      ]);
      break;
    }
    case "sales": {
      const sales = await prisma.sale.findMany({
        orderBy: { date: "desc" },
        include: { inventoryItem: true, customer: true },
      });
      headers = [
        "Date", "Item", "Customer", "Quantity", "Sale price", "Fees",
        "Shipping", "Cost (COGS)", "Profit", "Platform", "Notes",
      ];
      rows = sales.map((s) => [
        isoDate(s.date), s.inventoryItem?.name ?? "Misc sale",
        s.customer?.name ?? "", s.quantity, s.salePrice.toFixed(2),
        s.fees.toFixed(2), s.shipping.toFixed(2),
        s.costBasisAtSale.toFixed(2), s.profit.toFixed(2), s.platform, s.notes,
      ]);
      break;
    }
    case "expenses": {
      const expenses = await prisma.expense.findMany({
        orderBy: { date: "desc" },
      });
      headers = ["Date", "Category", "Amount", "Vendor", "Notes"];
      rows = expenses.map((e) => [
        isoDate(e.date), e.category, e.amount.toFixed(2), e.vendor, e.notes,
      ]);
      break;
    }
    case "customers": {
      const customers = await prisma.customer.findMany({
        orderBy: { name: "asc" },
        include: { sales: true },
      });
      headers = [
        "Name", "Email", "Phone", "Type", "Tags", "Orders",
        "Lifetime spend", "Notes",
      ];
      rows = customers.map((c) => [
        c.name, c.email, c.phone, c.type, c.tags, c.sales.length,
        c.sales.reduce((s, x) => s + x.salePrice, 0).toFixed(2), c.notes,
      ]);
      break;
    }
    case "leads": {
      const leads = await prisma.lead.findMany({
        orderBy: { createdAt: "desc" },
        include: { customer: true },
      });
      headers = [
        "Title", "Customer", "Contact name", "Contact info",
        "Interested in", "Stage", "Value", "Follow-up", "Notes",
      ];
      rows = leads.map((l) => [
        l.title, l.customer?.name ?? "", l.contactName, l.contactInfo,
        l.interestedIn, l.stage, l.value.toFixed(2),
        isoDate(l.followUpDate), l.notes,
      ]);
      break;
    }
    default:
      return new NextResponse("Unknown export type", { status: 404 });
  }

  const csv = toCsv(headers, rows);
  const filename = `${type}-${isoDate(new Date())}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
