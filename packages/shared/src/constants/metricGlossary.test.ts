import { describe, it, expect } from 'vitest';
import {
  OBSERVATION_HELP,
  ATTENTION_HELP,
  DASHBOARD_HELP,
  EXCEPTION_HELP,
  RECONCILIATION_HELP,
  MIGRATION_HELP,
  LOAN_HELP,
  SYSTEM_HEALTH_HELP,
  METRIC_GLOSSARY,
} from './metricGlossary';
import type { ObservationType, AttentionItemType, DrillDownMetric } from '../index';

// ─── Canonical enum values (source of truth from type definitions) ───

const OBSERVATION_TYPES: ObservationType[] = [
  'rate_variance', 'stalled_balance', 'negative_balance', 'multi_mda',
  'no_approval_match', 'consecutive_loan', 'period_overlap',
  'grade_tier_mismatch', 'three_way_variance', 'manual_exception', 'inactive_loan',
];

const ATTENTION_ITEM_TYPES: AttentionItemType[] = [
  'zero_deduction', 'post_retirement_active', 'missing_staff_id', 'overdue_loans',
  'stalled_deductions', 'quick_win', 'submission_variance', 'overdue_submission',
  'pending_auto_stop', 'pending_early_exit', 'dark_mda', 'onboarding_lag',
];

const DRILL_DOWN_METRICS: DrillDownMetric[] = [
  'activeLoans', 'totalExposure', 'fundAvailable', 'monthlyRecovery',
  'loansInWindow', 'outstandingReceivables', 'collectionPotential',
  'atRisk', 'completionRate', 'completionRateLifetime',
];

// ─── Tests ───────────────────────────────────────────────────────────

describe('metricGlossary enforcement', () => {
  describe('OBSERVATION_HELP — ObservationType sync', () => {
    it('has an entry for every ObservationType value', () => {
      for (const type of OBSERVATION_TYPES) {
        expect(OBSERVATION_HELP).toHaveProperty(type);
      }
    });

    it('has no orphaned entries beyond ObservationType values', () => {
      const glossaryKeys = Object.keys(OBSERVATION_HELP);
      for (const key of glossaryKeys) {
        expect(OBSERVATION_TYPES).toContain(key);
      }
    });

    it(`has exactly ${OBSERVATION_TYPES.length} entries`, () => {
      expect(Object.keys(OBSERVATION_HELP)).toHaveLength(OBSERVATION_TYPES.length);
    });
  });

  describe('ATTENTION_HELP — AttentionItemType sync', () => {
    it('has an entry for every AttentionItemType value', () => {
      for (const type of ATTENTION_ITEM_TYPES) {
        expect(ATTENTION_HELP).toHaveProperty(type);
      }
    });

    it('has no orphaned entries beyond AttentionItemType values', () => {
      const glossaryKeys = Object.keys(ATTENTION_HELP);
      for (const key of glossaryKeys) {
        expect(ATTENTION_ITEM_TYPES).toContain(key);
      }
    });

    it(`has exactly ${ATTENTION_ITEM_TYPES.length} entries`, () => {
      expect(Object.keys(ATTENTION_HELP)).toHaveLength(ATTENTION_ITEM_TYPES.length);
    });
  });

  describe('DASHBOARD_HELP — DrillDownMetric sync', () => {
    it('has an entry for every DrillDownMetric value', () => {
      for (const metric of DRILL_DOWN_METRICS) {
        expect(DASHBOARD_HELP).toHaveProperty(metric);
      }
    });

    it('has no orphaned entries beyond DrillDownMetric values', () => {
      const glossaryKeys = Object.keys(DASHBOARD_HELP);
      for (const key of glossaryKeys) {
        expect(DRILL_DOWN_METRICS).toContain(key);
      }
    });

    it(`has exactly ${DRILL_DOWN_METRICS.length} entries`, () => {
      expect(Object.keys(DASHBOARD_HELP)).toHaveLength(DRILL_DOWN_METRICS.length);
    });
  });

  describe('MetricDefinition field validation', () => {
    const allSections = {
      OBSERVATION_HELP,
      ATTENTION_HELP,
      DASHBOARD_HELP,
      EXCEPTION_HELP,
      RECONCILIATION_HELP,
      MIGRATION_HELP,
      LOAN_HELP,
      SYSTEM_HEALTH_HELP,
    };

    for (const [sectionName, section] of Object.entries(allSections)) {
      for (const [key, def] of Object.entries(section)) {
        it(`${sectionName}.${key} has non-empty description`, () => {
          expect(def.description.trim().length).toBeGreaterThan(0);
        });

        it(`${sectionName}.${key} has non-empty derivedFrom`, () => {
          expect(def.derivedFrom.trim().length).toBeGreaterThan(0);
        });

        it(`${sectionName}.${key} has non-empty label`, () => {
          expect(def.label.trim().length).toBeGreaterThan(0);
        });
      }
    }
  });

  describe('METRIC_GLOSSARY unified lookup', () => {
    it('contains all observation entries with "observation." prefix', () => {
      for (const type of OBSERVATION_TYPES) {
        expect(METRIC_GLOSSARY).toHaveProperty(`observation.${type}`);
      }
    });

    it('contains all attention entries with "attention." prefix', () => {
      for (const type of ATTENTION_ITEM_TYPES) {
        expect(METRIC_GLOSSARY).toHaveProperty(`attention.${type}`);
      }
    });

    it('contains all dashboard entries with "dashboard." prefix', () => {
      for (const metric of DRILL_DOWN_METRICS) {
        expect(METRIC_GLOSSARY).toHaveProperty(`dashboard.${metric}`);
      }
    });
  });
});
