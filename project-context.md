# VLPRS Project Context

## Metric Help System

When adding user-facing numbers to any screen:

1. **Add a glossary entry** to `packages/shared/src/constants/metricGlossary.ts`:
   - If the metric belongs to an exhaustive-typed section (`OBSERVATION_HELP`, `ATTENTION_HELP`, `DASHBOARD_HELP`), the TypeScript compiler will enforce the entry automatically.
   - For other sections (`EXCEPTION_HELP`, `RECONCILIATION_HELP`, `MIGRATION_HELP`, `LOAN_HELP`, `SYSTEM_HEALTH_HELP`), add the entry manually — enforced at code review time.

2. **Wrap the label** with `<MetricHelp>` in the component:
   ```tsx
   import { MetricHelp } from '@/components/shared/MetricHelp';

   // Glossary-backed (preferred)
   <p>Total Exposure <MetricHelp metric="dashboard.totalExposure" /></p>

   // Inline definition (for one-off cases)
   <p>Coverage <MetricHelp definition={{ label: 'Coverage', description: '...', derivedFrom: '...' }} /></p>
   ```

3. **For observation creators:** Provide a non-empty `completenessNote` in the `ObservationContext`. This field is required (`string`, not optional) and describes which data sources were consulted for the detection.

## Non-Punitive Vocabulary

All user-facing text must use approved vocabulary from `packages/shared/src/constants/vocabulary.ts`. Key rules:
- "Observation" not "Anomaly"
- "Variance" not "Discrepancy"
- No red badges or alarming language
