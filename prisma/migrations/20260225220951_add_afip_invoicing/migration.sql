-- CreateTable
CREATE TABLE "afip_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "puntoVenta" INTEGER NOT NULL DEFAULT 1,
    "accessToken" TEXT NOT NULL,
    "cert" TEXT,
    "privateKey" TEXT,
    "isProduction" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "afip_configs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "saleId" TEXT,
    "invoiceType" INTEGER NOT NULL,
    "invoiceTypeName" TEXT NOT NULL,
    "puntoVenta" INTEGER NOT NULL,
    "invoiceNumber" INTEGER NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "concepto" INTEGER NOT NULL DEFAULT 1,
    "docTipo" INTEGER NOT NULL,
    "docNro" TEXT NOT NULL,
    "customerName" TEXT,
    "netAmount" REAL NOT NULL,
    "exemptAmount" REAL NOT NULL DEFAULT 0,
    "ivaAmount" REAL NOT NULL DEFAULT 0,
    "tributesAmount" REAL NOT NULL DEFAULT 0,
    "totalAmount" REAL NOT NULL,
    "cae" TEXT,
    "caeExpiration" DATETIME,
    "afipResult" TEXT,
    "afipObservations" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "invoices_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "afip_configs_accountId_key" ON "afip_configs"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_accountId_invoiceType_puntoVenta_invoiceNumber_key" ON "invoices"("accountId", "invoiceType", "puntoVenta", "invoiceNumber");
