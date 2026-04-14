-- AlterTable
ALTER TABLE "purchase_payments" ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "paymentChannelId" TEXT;

-- AlterTable
ALTER TABLE "sale_payments" ADD COLUMN     "paymentAccountId" TEXT,
ADD COLUMN     "paymentChannelId" TEXT;

-- CreateTable
CREATE TABLE "payment_accounts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT,
    "identifier" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_channels" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "paymentAccountId" TEXT NOT NULL,
    "paymentMethodId" TEXT,
    "name" TEXT NOT NULL,
    "accreditationDays" INTEGER NOT NULL DEFAULT 0,
    "feePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_accounts_accountId_name_key" ON "payment_accounts"("accountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "payment_channels_accountId_name_key" ON "payment_channels"("accountId", "name");

-- AddForeignKey
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_channels" ADD CONSTRAINT "payment_channels_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_channels" ADD CONSTRAINT "payment_channels_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_channels" ADD CONSTRAINT "payment_channels_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_payments" ADD CONSTRAINT "sale_payments_paymentChannelId_fkey" FOREIGN KEY ("paymentChannelId") REFERENCES "payment_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_paymentChannelId_fkey" FOREIGN KEY ("paymentChannelId") REFERENCES "payment_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
