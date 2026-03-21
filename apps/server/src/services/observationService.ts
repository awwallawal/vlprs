/**
 * observationService — CRUD, status transitions, and promotion for observations.
 *
 * Follows loanTransitionService pattern for status validation.
 * Follows searchLoans pagination pattern for list queries.
 */

import { eq, and, sql, asc, desc, count } from 'drizzle-orm';
import { db } from '../db/index';
import { observations, exceptions, mdas } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import type {
  ObservationType,
  ObservationStatus,
  ObservationListItem,
  ObservationCounts,
  PaginatedObservations,
} from '@vlprs/shared';

// ─── Types ──────────────────────────────────────────────────────────

interface ObservationFilters {
  page?: number;
  pageSize?: number;
  type?: ObservationType;
  mdaId?: string;
  status?: ObservationStatus;
  staffName?: string;
  sortBy?: 'createdAt' | 'type' | 'staffName' | 'status';
  sortOrder?: 'asc' | 'desc';
}

// ─── Sort Column Map ────────────────────────────────────────────────

const SORT_COLUMNS = {
  createdAt: observations.createdAt,
  type: observations.type,
  staffName: observations.staffName,
  status: observations.status,
} as const;

// ─── List Observations ──────────────────────────────────────────────

export async function listObservations(
  filters: ObservationFilters = {},
  mdaScope?: string | null,
): Promise<PaginatedObservations> {
  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 25, 100);
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions: ReturnType<typeof eq>[] = [];

  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  if (filters.type) conditions.push(eq(observations.type, filters.type));
  if (filters.mdaId) conditions.push(eq(observations.mdaId, filters.mdaId));
  if (filters.status) conditions.push(eq(observations.status, filters.status));
  if (filters.staffName) {
    conditions.push(sql`${observations.staffName} ILIKE ${'%' + filters.staffName + '%'}`);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count query
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(observations)
    .where(whereClause);

  // Sort
  const sortCol = SORT_COLUMNS[filters.sortBy ?? 'createdAt'];
  const sortDirection = filters.sortOrder ?? 'desc';
  const orderExpr = sortDirection === 'asc' ? asc(sortCol) : desc(sortCol);

  // Data query with MDA join for name
  const rows = await db
    .select({
      id: observations.id,
      type: observations.type,
      staffName: observations.staffName,
      staffId: observations.staffId,
      mdaId: observations.mdaId,
      mdaName: mdas.name,
      description: observations.description,
      context: observations.context,
      sourceReference: observations.sourceReference,
      status: observations.status,
      reviewerNote: observations.reviewerNote,
      reviewedAt: observations.reviewedAt,
      resolutionNote: observations.resolutionNote,
      resolvedAt: observations.resolvedAt,
      promotedExceptionId: observations.promotedExceptionId,
      createdAt: observations.createdAt,
    })
    .from(observations)
    .leftJoin(mdas, eq(observations.mdaId, mdas.id))
    .where(whereClause)
    .orderBy(orderExpr)
    .limit(pageSize)
    .offset(offset);

  const data: ObservationListItem[] = rows.map((r) => ({
    id: r.id,
    type: r.type as ObservationType,
    staffName: r.staffName,
    staffId: r.staffId,
    mdaId: r.mdaId,
    mdaName: r.mdaName ?? 'Unknown MDA',
    description: r.description,
    context: r.context as ObservationListItem['context'],
    sourceReference: r.sourceReference as ObservationListItem['sourceReference'],
    status: r.status as ObservationStatus,
    reviewerNote: r.reviewerNote,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    resolutionNote: r.resolutionNote,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    promotedExceptionId: r.promotedExceptionId,
    createdAt: r.createdAt.toISOString(),
  }));

  const counts = await getObservationCounts(mdaScope);

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
    counts,
  };
}

// ─── Aggregate Counts ───────────────────────────────────────────────

export async function getObservationCounts(
  mdaScope?: string | null,
): Promise<ObservationCounts> {
  const conditions: ReturnType<typeof eq>[] = [];
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [result] = await db
    .select({
      total: count(),
      // By type
      rateVariance: sql<string>`COUNT(*) FILTER (WHERE ${observations.type} = 'rate_variance')`,
      stalledBalance: sql<string>`COUNT(*) FILTER (WHERE ${observations.type} = 'stalled_balance')`,
      negativeBalance: sql<string>`COUNT(*) FILTER (WHERE ${observations.type} = 'negative_balance')`,
      multiMda: sql<string>`COUNT(*) FILTER (WHERE ${observations.type} = 'multi_mda')`,
      noApprovalMatch: sql<string>`COUNT(*) FILTER (WHERE ${observations.type} = 'no_approval_match')`,
      consecutiveLoan: sql<string>`COUNT(*) FILTER (WHERE ${observations.type} = 'consecutive_loan')`,
      periodOverlap: sql<string>`COUNT(*) FILTER (WHERE ${observations.type} = 'period_overlap')`,
      gradeTierMismatch: sql<string>`COUNT(*) FILTER (WHERE ${observations.type} = 'grade_tier_mismatch')`,
      // By status
      unreviewed: sql<string>`COUNT(*) FILTER (WHERE ${observations.status} = 'unreviewed')`,
      reviewed: sql<string>`COUNT(*) FILTER (WHERE ${observations.status} = 'reviewed')`,
      resolved: sql<string>`COUNT(*) FILTER (WHERE ${observations.status} = 'resolved')`,
      promoted: sql<string>`COUNT(*) FILTER (WHERE ${observations.status} = 'promoted')`,
    })
    .from(observations)
    .where(whereClause);

  return {
    total: Number(result.total),
    byType: {
      rate_variance: parseInt(result.rateVariance, 10),
      stalled_balance: parseInt(result.stalledBalance, 10),
      negative_balance: parseInt(result.negativeBalance, 10),
      multi_mda: parseInt(result.multiMda, 10),
      no_approval_match: parseInt(result.noApprovalMatch, 10),
      consecutive_loan: parseInt(result.consecutiveLoan, 10),
      period_overlap: parseInt(result.periodOverlap, 10),
      grade_tier_mismatch: parseInt(result.gradeTierMismatch, 10),
    },
    byStatus: {
      unreviewed: parseInt(result.unreviewed, 10),
      reviewed: parseInt(result.reviewed, 10),
      resolved: parseInt(result.resolved, 10),
      promoted: parseInt(result.promoted, 10),
    },
  };
}

// ─── Status Transitions ────────────────────────────────────────────

export async function markAsReviewed(
  observationId: string,
  userId: string,
  note?: string,
): Promise<void> {
  const [obs] = await db
    .select({ id: observations.id, status: observations.status })
    .from(observations)
    .where(eq(observations.id, observationId))
    .limit(1);

  if (!obs) {
    throw new AppError(404, 'OBSERVATION_NOT_FOUND', VOCABULARY.OBSERVATION_NOT_FOUND);
  }

  if (obs.status === 'reviewed') {
    throw new AppError(400, 'OBSERVATION_ALREADY_REVIEWED', VOCABULARY.OBSERVATION_ALREADY_REVIEWED);
  }

  if (obs.status !== 'unreviewed') {
    throw new AppError(400, 'INVALID_TRANSITION', `Cannot mark as reviewed from status "${obs.status}"`);
  }

  await db
    .update(observations)
    .set({
      status: 'reviewed',
      reviewerId: userId,
      reviewerNote: note ?? null,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(observations.id, observationId));
}

export async function markAsResolved(
  observationId: string,
  userId: string,
  resolutionNote: string,
): Promise<void> {
  const [obs] = await db
    .select({ id: observations.id, status: observations.status })
    .from(observations)
    .where(eq(observations.id, observationId))
    .limit(1);

  if (!obs) {
    throw new AppError(404, 'OBSERVATION_NOT_FOUND', VOCABULARY.OBSERVATION_NOT_FOUND);
  }

  if (obs.status !== 'reviewed') {
    throw new AppError(400, 'OBSERVATION_REQUIRES_REVIEW', VOCABULARY.OBSERVATION_REQUIRES_REVIEW);
  }

  await db
    .update(observations)
    .set({
      status: 'resolved',
      resolutionNote,
      resolvedBy: userId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(observations.id, observationId));
}

// ─── Promote to Exception ───────────────────────────────────────────

export async function promoteToException(
  observationId: string,
  userId: string,
  priority: 'high' | 'medium' | 'low' = 'medium',
): Promise<{ exceptionId: string }> {
  const [obs] = await db
    .select({
      id: observations.id,
      status: observations.status,
      type: observations.type,
      staffName: observations.staffName,
      staffId: observations.staffId,
      mdaId: observations.mdaId,
      description: observations.description,
    })
    .from(observations)
    .where(eq(observations.id, observationId))
    .limit(1);

  if (!obs) {
    throw new AppError(404, 'OBSERVATION_NOT_FOUND', VOCABULARY.OBSERVATION_NOT_FOUND);
  }

  if (obs.status === 'resolved' || obs.status === 'promoted') {
    throw new AppError(400, 'INVALID_TRANSITION', `Cannot promote observation with status "${obs.status}"`);
  }

  // Create exception record
  const [exception] = await db
    .insert(exceptions)
    .values({
      observationId: obs.id,
      staffName: obs.staffName,
      staffId: obs.staffId,
      mdaId: obs.mdaId,
      category: obs.type,
      description: obs.description,
      priority,
      promotedBy: userId,
    })
    .returning({ id: exceptions.id });

  // Update observation status
  await db
    .update(observations)
    .set({
      status: 'promoted',
      promotedExceptionId: exception.id,
      updatedAt: new Date(),
    })
    .where(eq(observations.id, observationId));

  return { exceptionId: exception.id };
}

// ─── Per-staff Observation Count (for beneficiary ledger) ────────────

export async function getObservationCountByStaff(
  staffName: string,
  mdaScope?: string | null,
): Promise<number> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(observations.staffName, staffName),
  ];
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [result] = await db
    .select({ value: count() })
    .from(observations)
    .where(and(...conditions));

  return Number(result.value);
}

// ─── Per-MDA Observation Count (for dashboard) ──────────────────────

export async function getObservationCountsByMda(
  mdaScope?: string | null,
): Promise<Map<string, number>> {
  const conditions: ReturnType<typeof eq>[] = [];
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      mdaId: observations.mdaId,
      count: count(),
    })
    .from(observations)
    .where(whereClause)
    .groupBy(observations.mdaId);

  return new Map(rows.map((r) => [r.mdaId, Number(r.count)]));
}

// ─── Unreviewed Count (for beneficiary metrics) ─────────────────────

export async function getUnreviewedCount(
  mdaScope?: string | null,
): Promise<number> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(observations.status, 'unreviewed'),
  ];
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [result] = await db
    .select({ value: count() })
    .from(observations)
    .where(and(...conditions));

  return Number(result.value);
}

// ─── Per-staff Observations List (for StaffProfilePanel) ────────────

export async function getObservationsForStaff(
  staffName: string,
  mdaScope?: string | null,
): Promise<ObservationListItem[]> {
  const conditions: ReturnType<typeof eq>[] = [
    eq(observations.staffName, staffName),
  ];
  const scopeCondition = withMdaScope(observations.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const rows = await db
    .select({
      id: observations.id,
      type: observations.type,
      staffName: observations.staffName,
      staffId: observations.staffId,
      mdaId: observations.mdaId,
      mdaName: mdas.name,
      description: observations.description,
      context: observations.context,
      sourceReference: observations.sourceReference,
      status: observations.status,
      reviewerNote: observations.reviewerNote,
      reviewedAt: observations.reviewedAt,
      resolutionNote: observations.resolutionNote,
      resolvedAt: observations.resolvedAt,
      promotedExceptionId: observations.promotedExceptionId,
      createdAt: observations.createdAt,
    })
    .from(observations)
    .leftJoin(mdas, eq(observations.mdaId, mdas.id))
    .where(and(...conditions))
    .orderBy(desc(observations.createdAt));

  return rows.map((r) => ({
    id: r.id,
    type: r.type as ObservationType,
    staffName: r.staffName,
    staffId: r.staffId,
    mdaId: r.mdaId,
    mdaName: r.mdaName ?? 'Unknown MDA',
    description: r.description,
    context: r.context as ObservationListItem['context'],
    sourceReference: r.sourceReference as ObservationListItem['sourceReference'],
    status: r.status as ObservationStatus,
    reviewerNote: r.reviewerNote,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    resolutionNote: r.resolutionNote,
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    promotedExceptionId: r.promotedExceptionId,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ─── Batch Staff Observation Counts (for beneficiary ledger/CSV) ─────

export async function getObservationCountsByStaffNames(
  staffNames: string[],
): Promise<Map<string, number>> {
  if (staffNames.length === 0) return new Map();

  const obsCounts = await db
    .select({
      staffName: observations.staffName,
      cnt: count(),
    })
    .from(observations)
    .where(
      sql`${observations.staffName} IN (${sql.join(staffNames.map((n: string) => sql`${n}`), sql`, `)})`,
    )
    .groupBy(observations.staffName);

  return new Map(obsCounts.map((oc) => [oc.staffName, Number(oc.cnt)]));
}
