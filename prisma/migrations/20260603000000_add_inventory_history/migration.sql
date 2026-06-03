-- Add the BROKEN_DOWN outcome to the inventory status enum.
ALTER TYPE "ItemStatus" ADD VALUE IF NOT EXISTS 'BROKEN_DOWN';

-- New columns on InventoryItem: internal SKU, breakdown lineage, timestamp.
ALTER TABLE "InventoryItem" ADD COLUMN "internalSku" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "parentItemId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "brokenDownAt" TIMESTAMP(3);

-- Internal SKUs are unique across all inventory items.
CREATE UNIQUE INDEX "InventoryItem_internalSku_key" ON "InventoryItem"("internalSku");

-- Index + self-referencing FK for the parent/child breakdown relation.
CREATE INDEX "InventoryItem_parentItemId_idx" ON "InventoryItem"("parentItemId");
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
