-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'GC', 'ADMIN');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'PRE_CONSTRUCTION', 'ACTIVE', 'PUNCH_LIST', 'COMPLETE');

-- CreateEnum
CREATE TYPE "GCFeeModel" AS ENUM ('PERCENTAGE', 'FLAT');

-- CreateEnum
CREATE TYPE "PlanSetStatus" AS ENUM ('UPLOADED', 'PROCESSING', 'PARSED', 'REVIEWED', 'ERROR');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('NOT_STARTED', 'SCOPE_WRITTEN', 'OUT_FOR_BID', 'AWARDED', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('REQUESTED', 'VIEWED', 'RECEIVED', 'DECLINED', 'AWARDED');

-- CreateEnum
CREATE TYPE "ChangeOrderReason" AS ENUM ('OWNER_REQUEST', 'ARCHITECT_REVISION', 'FIELD_CONDITION', 'CODE_REQUIREMENT');

-- CreateEnum
CREATE TYPE "ChangeOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UPCOMING', 'READY', 'PAID');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('NOT_ORDERED', 'ORDERED', 'SHIPPED', 'DELIVERED', 'INSTALLED');

-- CreateEnum
CREATE TYPE "SelectionStatus" AS ENUM ('NOT_SELECTED', 'SELECTED', 'ORDERED', 'INSTALLED');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PASS', 'FAIL', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE', 'DELAYED');

-- CreateEnum
CREATE TYPE "SavingsCategory" AS ENUM ('COMPETITIVE_BIDDING', 'MATERIAL_SOURCING', 'NEGOTIATION', 'SCOPE_OPTIMIZATION', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phone" TEXT,
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "totalBudget" DOUBLE PRECISION,
    "gcFeeModel" "GCFeeModel" NOT NULL DEFAULT 'PERCENTAGE',
    "gcFeeAmount" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "squareFootage" DOUBLE PRECISION,
    "stories" INTEGER,
    "bedroomCount" INTEGER,
    "bathroomCount" DOUBLE PRECISION,
    "garageType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "gcId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSet" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "status" "PlanSetStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSheet" (
    "id" TEXT NOT NULL,
    "planSetId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "sheetType" TEXT,
    "thumbnailUrl" TEXT,
    "extractedText" TEXT,
    "imageUrl" TEXT,

    CONSTRAINT "PlanSheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanParsedData" (
    "id" TEXT NOT NULL,
    "planSetId" TEXT NOT NULL,
    "projectInfo" JSONB,
    "roomSchedule" JSONB,
    "doorSchedule" JSONB,
    "windowSchedule" JSONB,
    "fixtureCount" JSONB,
    "structuralNotes" JSONB,
    "finishSchedule" JSONB,
    "rawExtractions" JSONB,
    "confidence" JSONB,
    "reviewedSections" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanParsedData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "TradeStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "estimatedLow" DOUBLE PRECISION,
    "estimatedHigh" DOUBLE PRECISION,
    "description" TEXT,
    "awardedBidId" TEXT,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopeDocument" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "descriptionOfWork" TEXT NOT NULL,
    "inclusions" JSONB NOT NULL,
    "exclusions" JSONB NOT NULL,
    "materialSpecs" JSONB NOT NULL,
    "qualityStandards" JSONB NOT NULL,
    "timelineReqs" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generatedByAI" BOOLEAN NOT NULL DEFAULT true,
    "editedByUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "rating" DOUBLE PRECISION,
    "pastProjects" INTEGER,
    "trades" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION,
    "laborCost" DOUBLE PRECISION,
    "materialCost" DOUBLE PRECISION,
    "markupPercent" DOUBLE PRECISION,
    "timeline" TEXT,
    "status" "BidStatus" NOT NULL DEFAULT 'REQUESTED',
    "submittedAt" TIMESTAMP(3),
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLineItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "estimated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "committed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualToDate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "reason" "ChangeOrderReason" NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "tradesAffected" TEXT[],
    "costImpact" DOUBLE PRECISION NOT NULL,
    "scheduleImpact" INTEGER NOT NULL DEFAULT 0,
    "status" "ChangeOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "changeOrderId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "changeOrderId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "drawNumber" INTEGER NOT NULL,
    "milestone" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "payee" TEXT NOT NULL,
    "tradeId" TEXT,
    "invoiceNumber" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'UPCOMING',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "fileUrl" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "specification" TEXT,
    "category" TEXT NOT NULL,
    "supplier" TEXT,
    "unitCost" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "leadTimeDays" INTEGER,
    "orderDate" TIMESTAMP(3),
    "expectedDelivery" TIMESTAMP(3),
    "neededByDate" TIMESTAMP(3),
    "status" "MaterialStatus" NOT NULL DEFAULT 'NOT_ORDERED',
    "alternativeSuppliers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "allowanceAmount" DOUBLE PRECISION NOT NULL,
    "selectedProduct" TEXT,
    "selectedCost" DOUBLE PRECISION,
    "supplier" TEXT,
    "photoUrl" TEXT,
    "specUrl" TEXT,
    "status" "SelectionStatus" NOT NULL DEFAULT 'NOT_SELECTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "requiredDate" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "inspector" TEXT,
    "result" "InspectionResult",
    "notes" TEXT,
    "corrections" TEXT,
    "reInspectionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tradeId" TEXT,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "dependencies" TEXT[],
    "status" "ScheduleStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" "SavingsCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountSaved" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlanParsedData_planSetId_key" ON "PlanParsedData"("planSetId");

-- CreateIndex
CREATE UNIQUE INDEX "ScopeDocument_tradeId_key" ON "ScopeDocument"("tradeId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLineItem_tradeId_key" ON "BudgetLineItem"("tradeId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_gcId_fkey" FOREIGN KEY ("gcId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSet" ADD CONSTRAINT "PlanSet_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSheet" ADD CONSTRAINT "PlanSheet_planSetId_fkey" FOREIGN KEY ("planSetId") REFERENCES "PlanSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanParsedData" ADD CONSTRAINT "PlanParsedData_planSetId_fkey" FOREIGN KEY ("planSetId") REFERENCES "PlanSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopeDocument" ADD CONSTRAINT "ScopeDocument_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLineItem" ADD CONSTRAINT "BudgetLineItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_changeOrderId_fkey" FOREIGN KEY ("changeOrderId") REFERENCES "ChangeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialItem" ADD CONSTRAINT "MaterialItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Selection" ADD CONSTRAINT "Selection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsEntry" ADD CONSTRAINT "SavingsEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
