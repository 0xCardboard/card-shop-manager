-- Lifecycle location for inventory items (Brazil → US).
CREATE TYPE "InventoryLocation" AS ENUM ('BRAZIL', 'US');

ALTER TABLE "InventoryItem"
  ADD COLUMN "location" "InventoryLocation" NOT NULL DEFAULT 'US';

CREATE INDEX "InventoryItem_location_idx" ON "InventoryItem"("location");

-- Shipments: a batch move from Brazil to the US carrying landed costs.
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tariffs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "landedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipmentId" TEXT NOT NULL,
    "inventoryItemId" TEXT,

    CONSTRAINT "ShipmentItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShipmentItem_shipmentId_idx" ON "ShipmentItem"("shipmentId");
CREATE INDEX "ShipmentItem_inventoryItemId_idx" ON "ShipmentItem"("inventoryItemId");

ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShipmentItem" ADD CONSTRAINT "ShipmentItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
