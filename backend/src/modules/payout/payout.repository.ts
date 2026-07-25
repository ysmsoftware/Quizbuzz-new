import { prisma } from "../../config/db";
import { PayoutAccountStatus, PayoutOnboardingMode, RouteTransferStatus, Prisma } from "@prisma/client";

export class PayoutRepository {
  async findPayoutAccountByOrgId(organizationId: string) {
    return prisma.organizationPayoutAccount.findUnique({
      where: { organizationId },
    });
  }

  async findPayoutAccountByLinkedAccountId(razorpayLinkedAccountId: string) {
    return prisma.organizationPayoutAccount.findUnique({
      where: { razorpayLinkedAccountId },
    });
  }

  async upsertPayoutAccount(params: {
    organizationId: string;
    accountName: string;
    accountEmail: string;
    contactNumber?: string | undefined;
    razorpayLinkedAccountId?: string | undefined;
    status?: PayoutAccountStatus | undefined;
    onboardingMode?: PayoutOnboardingMode | undefined;
    metadata?: Prisma.InputJsonValue | undefined;
  }) {
    const { organizationId, accountName, accountEmail, contactNumber, razorpayLinkedAccountId, status, onboardingMode, metadata } = params;

    return prisma.organizationPayoutAccount.upsert({
      where: { organizationId },
      create: {
        organizationId,
        accountName,
        accountEmail,
        contactNumber: contactNumber || null,
        razorpayLinkedAccountId: razorpayLinkedAccountId || null,
        status: status || PayoutAccountStatus.PENDING,
        onboardingMode: onboardingMode || PayoutOnboardingMode.MANUAL,
        ...(metadata && { metadata: metadata as Prisma.InputJsonObject }),
      },
      update: {
        accountName,
        accountEmail,
        contactNumber: contactNumber || null,
        ...(razorpayLinkedAccountId && { razorpayLinkedAccountId }),
        ...(status && { status }),
        ...(onboardingMode && { onboardingMode }),
        ...(metadata && { metadata: metadata as Prisma.InputJsonObject }),
      },
    });
  }

  async updatePayoutAccountStatus(organizationId: string, params: {
    status: PayoutAccountStatus;
    razorpayLinkedAccountId?: string;
    activatedAt?: Date;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.organizationPayoutAccount.update({
      where: { organizationId },
      data: {
        status: params.status,
        ...(params.razorpayLinkedAccountId && { razorpayLinkedAccountId: params.razorpayLinkedAccountId }),
        ...(params.activatedAt && { activatedAt: params.activatedAt }),
        ...(params.metadata && { metadata: params.metadata as Prisma.InputJsonObject }),
      },
    });
  }

  async findRouteTransferByPaymentId(paymentId: string) {
    return prisma.paymentRouteTransfer.findUnique({
      where: { paymentId },
    });
  }

  async createRouteTransfer(data: {
    organizationId: string;
    paymentId: string;
    razorpayPaymentId: string;
    razorpayLinkedAccountId?: string | undefined;
    grossAmount: number;
    platformFeeAmount: number;
    gatewayFeeAmount: number;
    gstAmount: number;
    transferAmount: number;
    currency?: string;
    status?: RouteTransferStatus;
    razorpayTransferId?: string;
    failureReason?: string;
    processedAt?: Date;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.paymentRouteTransfer.create({
      data: {
        organizationId: data.organizationId,
        paymentId: data.paymentId,
        razorpayPaymentId: data.razorpayPaymentId,
        razorpayLinkedAccountId: data.razorpayLinkedAccountId || null,
        grossAmount: data.grossAmount,
        platformFeeAmount: data.platformFeeAmount,
        gatewayFeeAmount: data.gatewayFeeAmount,
        gstAmount: data.gstAmount,
        transferAmount: data.transferAmount,
        currency: data.currency || "INR",
        status: data.status || RouteTransferStatus.PENDING,
        razorpayTransferId: data.razorpayTransferId || null,
        failureReason: data.failureReason || null,
        processedAt: data.processedAt || null,
        ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonObject }),
      },
    });
  }

  async updateRouteTransferStatus(id: string, data: {
    status: RouteTransferStatus;
    razorpayTransferId?: string;
    failureReason?: string;
    processedAt?: Date;
    metadata?: Prisma.InputJsonValue;
  }) {
    return prisma.paymentRouteTransfer.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.razorpayTransferId && { razorpayTransferId: data.razorpayTransferId }),
        ...(data.failureReason && { failureReason: data.failureReason }),
        ...(data.failureReason !== undefined && { failureReason: data.failureReason }),
        ...(data.processedAt && { processedAt: data.processedAt }),
        ...(data.metadata && { metadata: data.metadata as Prisma.InputJsonObject }),
      },
    });
  }

  async listTransfersByOrgId(
    organizationId: string,
    params: { page: number; limit: number; status: string }
  ) {
    const where = {
      organizationId,
      ...(params.status !== "all" && { status: params.status as RouteTransferStatus }),
    };
    const [rows, total] = await Promise.all([
      prisma.paymentRouteTransfer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { payment: { include: { contest: { select: { title: true } } } } },
      }),
      prisma.paymentRouteTransfer.count({ where }),
    ]);
    return { rows, total };
  }

  /**
   * Reconciliation query: PENDING transfers with no failureReason (i.e. not the
   * legitimate "org has no active account yet" case) that are older than the grace
   * period. These are almost certainly interrupted attempts — createRouteTransferForPayment
   * will resume them correctly once re-invoked (see its stuck-transfer classification),
   * but if the job that would re-invoke it was itself lost, nothing calls it again
   * without this sweep finding it.
   */
  async findStuckPendingTransfers(olderThanMs: number, limit = 200) {
    const cutoff = new Date(Date.now() - olderThanMs);
    return prisma.paymentRouteTransfer.findMany({
      where: {
        status: RouteTransferStatus.PENDING,
        failureReason: null,
        createdAt: { lt: cutoff },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
  }

  async getTransferSummaryByOrgId(organizationId: string) {
    const [statusCounts, totalProcessedSum] = await Promise.all([
      prisma.paymentRouteTransfer.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { status: true },
      }),
      prisma.paymentRouteTransfer.aggregate({
        where: { organizationId, status: RouteTransferStatus.PROCESSED },
        _sum: { transferAmount: true },
      }),
    ]);

    const counts: Record<string, number> = {};
    for (const item of statusCounts) {
      counts[item.status] = item._count.status;
    }

    return {
      processed: counts[RouteTransferStatus.PROCESSED] || 0,
      pending: counts[RouteTransferStatus.PENDING] || 0,
      failed: counts[RouteTransferStatus.FAILED] || 0,
      totalReceivedAllTime: totalProcessedSum._sum.transferAmount || 0,
      currency: "INR",
    };
  }
}

