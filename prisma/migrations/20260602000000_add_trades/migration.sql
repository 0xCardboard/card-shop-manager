-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counterparty" TEXT,
    "cashIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "givenBasis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "receivedBasis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedGain" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeLeg" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "basis" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tradeId" TEXT NOT NULL,
    "inventoryItemId" TEXT,

    CONSTRAINT "TradeLeg_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TradeLeg_tradeId_idx" ON "TradeLeg"("tradeId");

-- CreateIndex
CREATE INDEX "TradeLeg_inventoryItemId_idx" ON "TradeLeg"("inventoryItemId");

-- AddForeignKey
ALTER TABLE "TradeLeg" ADD CONSTRAINT "TradeLeg_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeLeg" ADD CONSTRAINT "TradeLeg_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
