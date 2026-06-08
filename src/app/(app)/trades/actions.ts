"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { intNum, num, optDate, optStr, str } from "@/lib/utils";
import { nextInternalSku } from "@/lib/sku";

// Log a trade: items (and optionally cash) given are swapped for items (and
// optionally cash) received. The cost basis of the items given is pooled,
// adjusted for cash (cash you pay adds basis, cash you receive subtracts),
// and passed through to the items received so total cost basis is conserved.
export async function createTrade(formData: FormData) {
  await requireSession();

  const date = optDate(formData.get("date")) ?? new Date();
  const counterparty = optStr(formData.get("counterparty"));
  const notes = optStr(formData.get("notes"));
  const cashIn = Math.max(0, num(formData.get("cashIn"))); // cash received
  const cashOut = Math.max(0, num(formData.get("cashOut"))); // cash paid

  // Parallel arrays from the dynamic form rows.
  const givenIds = formData.getAll("givenId").map(str);
  const givenQtys = formData.getAll("givenQty").map((v) => intNum(v));
  const recvNames = formData.getAll("receivedName").map(str);
  const recvQtys = formData.getAll("receivedQty").map((v) => intNum(v));
  const recvValues = formData.getAll("receivedValue").map((v) => num(v));

  // Resolve the items being given away (skip empty/zero rows).
  const given: { id: string; qty: number }[] = [];
  for (let i = 0; i < givenIds.length; i++) {
    const id = givenIds[i];
    const qty = Math.max(0, givenQtys[i] ?? 0);
    if (id && qty > 0) given.push({ id, qty });
  }

  // Resolve the items being received (skip rows with no name/qty).
  const received: { name: string; qty: number; value: number }[] = [];
  for (let i = 0; i < recvNames.length; i++) {
    const name = recvNames[i];
    const qty = Math.max(0, recvQtys[i] ?? 0);
    const value = Math.max(0, recvValues[i] ?? 0);
    if (name && qty > 0) received.push({ name, qty, value });
  }

  if (given.length === 0 && cashOut === 0) {
    throw new Error("Add at least one item you gave (or cash you paid).");
  }
  if (received.length === 0) {
    throw new Error(
      "Add at least one item you received. To swap items purely for cash, log a Sale instead."
    );
  }

  // Snapshot the cost basis of each given item.
  const givenResolved = await Promise.all(
    given.map(async (g) => {
      const item = await prisma.inventoryItem.findUnique({ where: { id: g.id } });
      if (!item) throw new Error("An item you tried to give no longer exists.");
      if (g.qty > item.quantity) {
        throw new Error(
          `You only have ${item.quantity} of "${item.name}" to trade.`
        );
      }
      return { item, qty: g.qty, basis: g.qty * item.costBasis };
    })
  );

  const givenBasis = givenResolved.reduce((s, g) => s + g.basis, 0);
  // Net cost basis to pass through to the items received.
  const receivedBasis = Math.max(0, givenBasis + cashOut - cashIn);
  // If cash received exceeds the basis given (plus any cash paid), the excess
  // is a realized gain — taxable income, like a partial sale.
  const realizedGain = Math.max(0, cashIn - cashOut - givenBasis);

  // Distribute the net basis across received items, weighted by the estimated
  // value entered (or evenly by quantity if no values were provided).
  const totalValue = received.reduce((s, r) => s + r.value, 0);
  const totalQty = received.reduce((s, r) => s + r.qty, 0);
  const shares = received.map((r) => {
    const weight =
      totalValue > 0 ? r.value / totalValue : totalQty > 0 ? r.qty / totalQty : 0;
    return receivedBasis * weight;
  });

  await prisma.$transaction(async (tx) => {
    const trade = await tx.trade.create({
      data: {
        date,
        counterparty,
        cashIn,
        cashOut,
        givenBasis,
        receivedBasis,
        realizedGain,
        notes,
      },
    });

    // Consume the given items and record a GAVE leg for each.
    for (const g of givenResolved) {
      await tx.inventoryItem.update({
        where: { id: g.item.id },
        data: { quantity: g.item.quantity - g.qty },
      });
      await tx.tradeLeg.create({
        data: {
          tradeId: trade.id,
          direction: "GAVE",
          itemName: g.item.name,
          quantity: g.qty,
          basis: g.basis,
          inventoryItemId: g.item.id,
        },
      });
    }

    // Create the received items (inheriting the pooled basis) and a leg each.
    for (let i = 0; i < received.length; i++) {
      const r = received[i];
      const legBasis = shares[i];
      const created = await tx.inventoryItem.create({
        data: {
          name: r.name,
          quantity: r.qty,
          costBasis: r.qty > 0 ? legBasis / r.qty : 0,
          acquisitionDate: date,
          status: "IN_STOCK",
          internalSku: await nextInternalSku(tx),
          notes: counterparty
            ? `Acquired via trade with ${counterparty}`
            : "Acquired via trade",
        },
      });
      await tx.tradeLeg.create({
        data: {
          tradeId: trade.id,
          direction: "RECEIVED",
          itemName: r.name,
          quantity: r.qty,
          basis: legBasis,
          inventoryItemId: created.id,
        },
      });
    }
  });

  revalidatePath("/trades");
  revalidatePath("/inventory");
  redirect("/inventory?tab=history");
}

// Delete a trade and best-effort reverse its inventory effects: restore the
// quantities given (folding their basis back in) and remove the quantities
// received.
export async function deleteTrade(formData: FormData) {
  await requireSession();
  const id = str(formData.get("id"));

  const trade = await prisma.trade.findUnique({
    where: { id },
    include: { legs: true },
  });
  if (!trade) return;

  await prisma.$transaction(async (tx) => {
    for (const leg of trade.legs) {
      if (!leg.inventoryItemId) continue;
      const item = await tx.inventoryItem.findUnique({
        where: { id: leg.inventoryItemId },
      });
      if (!item) continue;

      if (leg.direction === "GAVE") {
        // Put the given units back, folding the snapshotted basis back in.
        const newQty = item.quantity + leg.quantity;
        const newCost =
          newQty > 0
            ? (item.quantity * item.costBasis + leg.basis) / newQty
            : item.costBasis;
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: newQty, costBasis: newCost },
        });
      } else {
        // Remove the received units.
        await tx.inventoryItem.update({
          where: { id: item.id },
          data: { quantity: Math.max(0, item.quantity - leg.quantity) },
        });
      }
    }
    await tx.trade.delete({ where: { id: trade.id } });
  });

  revalidatePath("/trades");
  revalidatePath("/inventory");
}
