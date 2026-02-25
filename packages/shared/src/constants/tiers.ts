export interface LoanTierConfig {
  tier: number;
  gradeLevels: string; // Human-readable, e.g. "Levels 1-6"
  minGradeLevel: number;
  maxGradeLevel: number;
  maxPrincipal: string; // NUMERIC as string, e.g. "250000.00"
  standardTenureMonths: number;
  standardMoratoriumMonths: number;
}

export const LOAN_TIERS: LoanTierConfig[] = [
  { tier: 1, gradeLevels: 'Levels 1-6', minGradeLevel: 1, maxGradeLevel: 6, maxPrincipal: '250000.00', standardTenureMonths: 60, standardMoratoriumMonths: 2 },
  { tier: 2, gradeLevels: 'Levels 7-8', minGradeLevel: 7, maxGradeLevel: 8, maxPrincipal: '450000.00', standardTenureMonths: 60, standardMoratoriumMonths: 2 },
  { tier: 3, gradeLevels: 'Levels 9-10', minGradeLevel: 9, maxGradeLevel: 10, maxPrincipal: '600000.00', standardTenureMonths: 60, standardMoratoriumMonths: 2 },
  { tier: 4, gradeLevels: 'Levels 12+', minGradeLevel: 12, maxGradeLevel: 99, maxPrincipal: '750000.00', standardTenureMonths: 60, standardMoratoriumMonths: 2 },
];

// NOTE: Grade Level 11 intentionally returns undefined — GL 11 is not eligible for the car loan
// scheme per PRD/epics/wireframes which all specify "Levels 12+" for Tier 4.
// Callers (e.g. Story 2.1 loan creation) MUST handle undefined with a clear error message.
export function getTierForGradeLevel(gradeLevel: number): LoanTierConfig | undefined {
  return LOAN_TIERS.find(t => gradeLevel >= t.minGradeLevel && gradeLevel <= t.maxGradeLevel);
}
