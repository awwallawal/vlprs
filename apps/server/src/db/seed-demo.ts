import { eq } from 'drizzle-orm';
import { db } from './index';
import { mdas, users, loans, schemeConfig } from './schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import { seedReferenceMdas } from './seedReferenceMdas';

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || 'DemoPass1';

// Mock loan data for seeding (5-10 representative loans across 2-3 MDAs)
function buildMockLoans(mdaMap: Map<string, string>) {
  const healthMdaId = mdaMap.get('HEALTH');
  const educationMdaId = mdaMap.get('EDUCATION');
  const financeMdaId = mdaMap.get('FINANCE');

  if (!healthMdaId || !educationMdaId || !financeMdaId) return [];

  return [
    {
      id: generateUuidv7(),
      staffId: 'OY/HLT/0231',
      staffName: 'Adebayo Olusegun',
      gradeLevel: 'GL 12',
      mdaId: healthMdaId,
      principalAmount: '500000.00',
      interestRate: '6.000',
      tenureMonths: 36,
      moratoriumMonths: 0,
      monthlyDeductionAmount: '15278.00',
      approvalDate: new Date('2024-03-15'),
      firstDeductionDate: new Date('2024-04-01'),
      loanReference: 'VLC-2024-0001',
      status: 'ACTIVE' as const,
    },
    {
      id: generateUuidv7(),
      staffId: 'OY/HLT/0187',
      staffName: 'Fatimah Abubakar',
      gradeLevel: 'GL 10',
      mdaId: healthMdaId,
      principalAmount: '350000.00',
      interestRate: '6.000',
      tenureMonths: 24,
      moratoriumMonths: 0,
      monthlyDeductionAmount: '15458.00',
      approvalDate: new Date('2024-06-10'),
      firstDeductionDate: new Date('2024-07-01'),
      loanReference: 'VLC-2024-0002',
      status: 'ACTIVE' as const,
    },
    {
      id: generateUuidv7(),
      staffId: 'OY/EDU/0412',
      staffName: 'Ibrahim Musa',
      gradeLevel: 'GL 14',
      mdaId: educationMdaId,
      principalAmount: '750000.00',
      interestRate: '5.500',
      tenureMonths: 48,
      moratoriumMonths: 3,
      monthlyDeductionAmount: '17188.00',
      approvalDate: new Date('2024-01-20'),
      firstDeductionDate: new Date('2024-05-01'),
      loanReference: 'VLC-2024-0003',
      status: 'ACTIVE' as const,
    },
    {
      id: generateUuidv7(),
      staffId: 'OY/EDU/0298',
      staffName: 'Amina Yusuf',
      gradeLevel: 'GL 08',
      mdaId: educationMdaId,
      principalAmount: '200000.00',
      interestRate: '6.000',
      tenureMonths: 12,
      moratoriumMonths: 0,
      monthlyDeductionAmount: '17667.00',
      approvalDate: new Date('2023-11-01'),
      firstDeductionDate: new Date('2023-12-01'),
      loanReference: 'VLC-2023-0001',
      status: 'COMPLETED' as const,
    },
    {
      id: generateUuidv7(),
      staffId: 'OY/FIN/0055',
      staffName: 'Oluwaseun Adeyemi',
      gradeLevel: 'GL 15',
      mdaId: financeMdaId,
      principalAmount: '1000000.00',
      interestRate: '5.000',
      tenureMonths: 60,
      moratoriumMonths: 6,
      monthlyDeductionAmount: '18333.00',
      approvalDate: new Date('2024-08-01'),
      firstDeductionDate: new Date('2025-03-01'),
      loanReference: 'VLC-2024-0004',
      status: 'APPROVED' as const,
    },
    {
      id: generateUuidv7(),
      staffId: 'OY/FIN/0123',
      staffName: 'Chidinma Okafor',
      gradeLevel: 'GL 09',
      mdaId: financeMdaId,
      principalAmount: '300000.00',
      interestRate: '6.000',
      tenureMonths: 24,
      moratoriumMonths: 0,
      monthlyDeductionAmount: '13250.00',
      approvalDate: new Date('2024-02-14'),
      firstDeductionDate: new Date('2024-03-01'),
      loanReference: 'VLC-2024-0005',
      status: 'ACTIVE' as const,
    },
    {
      id: generateUuidv7(),
      staffId: 'OY/HLT/0099',
      staffName: 'Tunde Bakare',
      gradeLevel: 'GL 07',
      mdaId: healthMdaId,
      principalAmount: '150000.00',
      interestRate: '6.500',
      tenureMonths: 12,
      moratoriumMonths: 0,
      monthlyDeductionAmount: '13313.00',
      approvalDate: new Date('2024-09-01'),
      firstDeductionDate: new Date('2024-10-01'),
      loanReference: 'VLC-2024-0006',
      status: 'APPLIED' as const,
    },
  ];
}

/**
 * Core seed logic — reusable by both CLI and dev auto-seed.
 * Idempotent: uses onConflictDoNothing for both MDAs and users.
 */
export async function runDemoSeed(): Promise<{ userCount: number; loanCount: number }> {
  console.log('Running FULL demo seed (admin users + demo loans + scheme config)...');
  const hashedPassword = await hashPassword(DEMO_PASSWORD);

  let userCount = 0;
  let loanCount = 0;

  // 1. Seed reference MDAs (idempotent, shared with all environments)
  await seedReferenceMdas();

  await db.transaction(async (tx) => {
    // 2. Lookup MDA IDs for user assignment
    const allMdaRows = await tx.select().from(mdas);
    const mdaMap = new Map<string, string>();
    for (const m of allMdaRows) {
      mdaMap.set(m.code, m.id);
    }

    // 3. Seed demo user accounts using authoritative MDA codes
    const healthMdaId = mdaMap.get('HEALTH') ?? null;
    const educationMdaId = mdaMap.get('EDUCATION') ?? null;

    const DEMO_USERS = [
      { email: 'ag@vlprs.oyo.gov.ng', firstName: 'Accountant', lastName: 'General', role: 'super_admin' as const, mdaId: null },
      { email: 'deputy.ag@vlprs.oyo.gov.ng', firstName: 'Deputy', lastName: 'AG', role: 'super_admin' as const, mdaId: null },
      { email: 'admin@vlprs.oyo.gov.ng', firstName: 'Department', lastName: 'Admin', role: 'dept_admin' as const, mdaId: null },
      { email: 'health.officer@vlprs.oyo.gov.ng', firstName: 'Health', lastName: 'Officer', role: 'mda_officer' as const, mdaId: healthMdaId },
      { email: 'education.officer@vlprs.oyo.gov.ng', firstName: 'Education', lastName: 'Officer', role: 'mda_officer' as const, mdaId: educationMdaId },
      { email: 'bir.officer@oyo.gov.ng', firstName: 'BIR', lastName: 'Officer', role: 'mda_officer' as const, mdaId: mdaMap.get('BIR') ?? null },
    ];

    for (const user of DEMO_USERS) {
      const [record] = await tx
        .insert(users)
        .values({
          id: generateUuidv7(),
          email: user.email,
          hashedPassword: hashedPassword,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          mdaId: user.mdaId,
        })
        .onConflictDoNothing({ target: users.email })
        .returning();
      if (record) userCount++;
    }

    // 5. Seed mock loan records
    const mockLoans = buildMockLoans(mdaMap);
    for (const loan of mockLoans) {
      const [record] = await tx
        .insert(loans)
        .values(loan)
        .onConflictDoNothing({ target: loans.loanReference })
        .returning();
      if (record) loanCount++;
    }

    // 6. Seed scheme fund total for development (₦500,000,000)
    const agUser = await tx.select({ id: users.id }).from(users).where(eq(users.email, 'ag@vlprs.oyo.gov.ng'));
    const agUserId = agUser[0]?.id;
    if (agUserId) {
      await tx
        .insert(schemeConfig)
        .values({ key: 'scheme_fund_total', value: '500000000.00', updatedBy: agUserId })
        .onConflictDoNothing({ target: schemeConfig.key });
    }
  });

  return { userCount, loanCount };
}

// CLI entry point — only runs when executed directly (not when imported)
const isDirectRun = process.argv[1]?.includes('seed-demo');
if (isDirectRun) {
  console.log('Seeding demo data...');
  runDemoSeed()
    .then(({ userCount, loanCount }) => {
      console.log(`Seeded ${userCount} users, ${loanCount} loans`);
      console.log('Demo seed complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
