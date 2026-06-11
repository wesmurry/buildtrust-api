-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('BLS_OEWS', 'PUBLISHED_ESTIMATE', 'PHCC', 'NECA', 'MCAA', 'CRAFTSMAN', 'SUPPLIER_FEED', 'PLATFORM_OBSERVED', 'MANUAL');

-- CreateEnum
CREATE TYPE "ScopeLineCategory" AS ENUM ('LABOR', 'MATERIAL', 'EQUIPMENT', 'ALLOWANCE', 'GENERAL');

-- CreateEnum
CREATE TYPE "BidLineKind" AS ENUM ('INCLUSION', 'EXCLUSION', 'ALLOWANCE', 'ALTERNATE');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('BLOCKED_SCOPE_GATE', 'DRAFT', 'BUILDER_REVIEWED', 'CLIENT_VISIBLE');

-- CreateEnum
CREATE TYPE "VerdictZone" AS ENUM ('WITHIN_RANGE', 'ABOVE_RANGE', 'BELOW_RANGE');

-- CreateTable
CREATE TABLE "ScopeLineItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "csiCode" TEXT,
    "description" TEXT NOT NULL,
    "category" "ScopeLineCategory" NOT NULL DEFAULT 'GENERAL',
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "laborTaskCode" TEXT,
    "materialCode" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopeLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidDocument" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "fileName" TEXT,
    "rawText" TEXT NOT NULL,
    "parsedAt" TIMESTAMP(3),
    "parseModel" TEXT,
    "parserVersion" TEXT,
    "parseConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidLineItem" (
    "id" TEXT NOT NULL,
    "bidId" TEXT NOT NULL,
    "scopeLineItemId" TEXT,
    "description" TEXT NOT NULL,
    "kind" "BidLineKind" NOT NULL DEFAULT 'INCLUSION',
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "unitPriceCents" INTEGER,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "laborCents" INTEGER,
    "materialCents" INTEGER,
    "confidence" DOUBLE PRECISION,
    "sourceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborUnit" (
    "id" TEXT NOT NULL,
    "tradeCategory" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "hoursPerUnit" DOUBLE PRECISION NOT NULL,
    "conditions" TEXT,
    "source" "DataSource" NOT NULL,
    "sourceRef" TEXT,
    "effectiveDate" TIMESTAMP(3),

    CONSTRAINT "LaborUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WageRate" (
    "id" TEXT NOT NULL,
    "msaCode" TEXT NOT NULL,
    "msaName" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "hourlyMedianCents" INTEGER NOT NULL,
    "hourlyP75Cents" INTEGER NOT NULL,
    "source" "DataSource" NOT NULL,
    "sourceRef" TEXT,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WageRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BurdenFactor" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "tradeCategory" TEXT NOT NULL,
    "payrollTaxPct" DOUBLE PRECISION NOT NULL,
    "workersCompPct" DOUBLE PRECISION NOT NULL,
    "otherPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "source" "DataSource" NOT NULL,
    "sourceRef" TEXT,

    CONSTRAINT "BurdenFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeMarginNorm" (
    "id" TEXT NOT NULL,
    "tradeCategory" TEXT NOT NULL,
    "overheadPctLow" DOUBLE PRECISION NOT NULL,
    "overheadPctHigh" DOUBLE PRECISION NOT NULL,
    "netMarginPctLow" DOUBLE PRECISION NOT NULL,
    "netMarginPctHigh" DOUBLE PRECISION NOT NULL,
    "basis" TEXT,
    "source" "DataSource" NOT NULL,
    "sourceRef" TEXT,
    "asOf" TIMESTAMP(3),

    CONSTRAINT "TradeMarginNorm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPriceRef" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "region" TEXT NOT NULL,
    "source" "DataSource" NOT NULL,
    "sourceRef" TEXT,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPriceRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketHeatFactor" (
    "id" TEXT NOT NULL,
    "msaCode" TEXT NOT NULL,
    "tradeCategory" TEXT NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL,
    "basis" TEXT NOT NULL,
    "source" "DataSource" NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketHeatFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairPriceAssessment" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "bidId" TEXT,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "scopeGate" JSONB NOT NULL,
    "bandLowCents" INTEGER NOT NULL,
    "bandHighCents" INTEGER NOT NULL,
    "pointEstimateCents" INTEGER NOT NULL,
    "bandPct" DOUBLE PRECISION NOT NULL,
    "verdict" "VerdictZone",
    "layers" JSONB NOT NULL,
    "assumptions" JSONB NOT NULL,
    "marketHeatFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "engineVersion" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairPriceAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaborUnit_taskCode_key" ON "LaborUnit"("taskCode");

-- CreateIndex
CREATE UNIQUE INDEX "WageRate_msaCode_socCode_asOf_key" ON "WageRate"("msaCode", "socCode", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "BurdenFactor_state_tradeCategory_key" ON "BurdenFactor"("state", "tradeCategory");

-- CreateIndex
CREATE UNIQUE INDEX "TradeMarginNorm_tradeCategory_key" ON "TradeMarginNorm"("tradeCategory");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPriceRef_itemCode_region_asOf_key" ON "MaterialPriceRef"("itemCode", "region", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "MarketHeatFactor_msaCode_tradeCategory_asOf_key" ON "MarketHeatFactor"("msaCode", "tradeCategory", "asOf");

-- AddForeignKey
ALTER TABLE "ScopeLineItem" ADD CONSTRAINT "ScopeLineItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidDocument" ADD CONSTRAINT "BidDocument_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidLineItem" ADD CONSTRAINT "BidLineItem_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidLineItem" ADD CONSTRAINT "BidLineItem_scopeLineItemId_fkey" FOREIGN KEY ("scopeLineItemId") REFERENCES "ScopeLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairPriceAssessment" ADD CONSTRAINT "FairPriceAssessment_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairPriceAssessment" ADD CONSTRAINT "FairPriceAssessment_bidId_fkey" FOREIGN KEY ("bidId") REFERENCES "Bid"("id") ON DELETE SET NULL ON UPDATE CASCADE;
