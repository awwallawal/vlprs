import { db } from './index';
import { mdas, mdaAliases, users, loans } from './schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || 'DemoPass1';

// Authoritative MDA list from docs/mdas_list.txt — 63 entries
// Format: { name, code, abbreviation }
const ALL_MDAS = [
  { name: 'Oyo State Hospital Management Board', code: 'OYSHMB', abbreviation: 'OYSHMB' },
  { name: 'Ministry of Finance', code: 'FINANCE', abbreviation: 'Finance' },
  { name: 'Agricultural Credit Corporation of Oyo State', code: 'ACCOS', abbreviation: 'ACCOS' },
  { name: 'Library Board', code: 'LIBRARY', abbreviation: 'Library Board' },
  { name: 'Ministry of Local Government and Chieftaincy Matters', code: 'LOCAL GOVERNMENT', abbreviation: 'Local Govt' },
  { name: 'Ministry of Information', code: 'INFORMATION', abbreviation: 'Information' },
  { name: 'Public Complaints Commission', code: 'PCC', abbreviation: 'PCC' },
  { name: 'Bureau of Statistics', code: 'STATISTICS', abbreviation: 'Statistics' },
  { name: 'Board for Technical and Vocational Education', code: 'BOTAVED', abbreviation: 'BOTAVED' },
  { name: 'Ministry of Special Duties', code: 'SPECIAL DUTIES', abbreviation: 'Special Duties' },
  { name: 'Oyo State Housing Corporation', code: 'HOUSING', abbreviation: 'Housing Corp' },
  { name: 'Local Government Audit Commission', code: 'LOCAL GOVERNMENT AUDIT', abbreviation: 'LG Audit' },
  { name: 'Office of the Surveyor General', code: 'SURVEYOR GENERAL', abbreviation: 'Surveyor General' },
  { name: 'Teaching Service Commission', code: 'TESCOM', abbreviation: 'TESCOM' },
  { name: 'Ministry of Women Affairs', code: 'WOMEN AFFAIRS', abbreviation: 'Women Affairs' },
  { name: 'Oyo State Legislature', code: 'LEGISLATURE', abbreviation: 'Legislature' },
  { name: 'Broadcasting Corporation of Oyo State', code: 'BCOS', abbreviation: 'BCOS' },
  { name: 'Ministry of Environment', code: 'ENVIRONMENT', abbreviation: 'Environment' },
  { name: 'State Universal Basic Education Board', code: 'SUBEB', abbreviation: 'SUBEB' },
  { name: 'Oyo State Sports Council', code: 'SPORTS COUNCIL', abbreviation: 'Sports Council' },
  { name: 'House of Assembly Commission', code: 'ASSEMBLY COMMISSION', abbreviation: 'Assembly Commission' },
  { name: 'Oyo State Water Corporation', code: 'WATER CORPORATION', abbreviation: 'Water Corp' },
  { name: 'Board of Internal Revenue', code: 'BIR', abbreviation: 'BIR' },
  { name: 'Ministry of Budget and Economic Planning', code: 'BUDGET AND PLANNING', abbreviation: 'Budget & Planning' },
  { name: 'Oyo State Judicial Service Commission', code: 'JUDICIAL COMMISSION', abbreviation: 'Judicial Commission' },
  { name: 'Ministry of Health', code: 'HEALTH', abbreviation: 'Health' },
  { name: 'College of Health Sciences', code: 'HEALTH COLLEGE', abbreviation: 'Health College' },
  { name: 'College of Nursing and Midwifery', code: 'NURSING AND MIDWIFERY', abbreviation: 'Nursing & Midwifery' },
  { name: 'Oyo State Agency for Adult and Non-Formal Education', code: 'AANFE', abbreviation: 'AANFE' },
  { name: 'Ministry of Energy and Mineral Resources', code: 'ENERGY RESOURCES', abbreviation: 'Energy Resources' },
  { name: 'Oyo State Health Insurance Agency', code: 'OYSHIA', abbreviation: 'OYSHIA' },
  { name: 'Ministry of Establishment', code: 'ESTABLISHMENT', abbreviation: 'Establishment' },
  { name: 'Oyo State Investment, Public and Private Partnership Agency', code: 'OYSIPA', abbreviation: 'OYSIPA' },
  { name: 'Oyo State Road Traffic Management Agency', code: 'OYRTMA', abbreviation: 'OYRTMA' },
  { name: 'Oyo State Independent Electoral Commission', code: 'OYSIEC', abbreviation: 'OYSIEC' },
  { name: 'Oyo State Primary Healthcare Board', code: 'OYSPHB', abbreviation: 'OYSPHB' },
  { name: 'Oyo State Mineral Development Agency', code: 'OYSMDA', abbreviation: 'OYSMDA' },
  { name: 'Ministry of Lands and Housing', code: 'LANDS AND HOUSING', abbreviation: 'Lands & Housing' },
  { name: 'Ministry of Education', code: 'EDUCATION', abbreviation: 'Education' },
  { name: 'Oyo State Advertising Agency', code: 'OYSAA', abbreviation: 'OYSAA' },
  { name: 'Oyo State Rural Electrification Board', code: 'OYSREB', abbreviation: 'OYSREB' },
  { name: "Governor's Office", code: 'GOVERNOR OFFICE', abbreviation: "Governor's Office" },
  { name: "Accountant General's Office", code: 'ACCOUNTANT GENERAL', abbreviation: 'Accountant General' },
  { name: 'Ministry of Arts and Culture', code: 'ARTS AND CULTURE', abbreviation: 'Arts & Culture' },
  { name: 'Oyo State High Court', code: 'HIGH COURT', abbreviation: 'High Court' },
  { name: 'Oyo State Agency for Youth Development', code: 'YOUTH DEVELOPMENT', abbreviation: 'Youth Development' },
  { name: 'Oyo State Road Maintenance Agency', code: 'OYSROMA', abbreviation: 'OYSROMA' },
  { name: 'Head of Service Office', code: 'HOS', abbreviation: 'HOS' },
  { name: 'Oyo State Government Printing Press', code: 'PRINTING PRESS', abbreviation: 'Printing Press' },
  { name: 'Cocoa Development Unit', code: 'CDU', abbreviation: 'CDU' },
  { name: 'Auditor General of Oyo State', code: 'AUDITOR GENERAL', abbreviation: 'Auditor General' },
  { name: 'Ministry of Works and Transport', code: 'WORKS AND TRANSPORT', abbreviation: 'Works & Transport' },
  { name: 'Oyo State Agricultural Development Agency', code: 'OYSADA', abbreviation: 'OYSADA' },
  { name: 'Civil Service Commission', code: 'CSC', abbreviation: 'CSC' },
  { name: 'Ministry of Youth and Sports', code: 'YOUTH AND SPORTS', abbreviation: 'Youth & Sports' },
  { name: 'Ministry of Trade, Investment and Cooperatives', code: 'TRADE', abbreviation: 'Trade' },
  { name: 'Oyo State Pensions Board', code: 'PENSIONS BOARD', abbreviation: 'Pensions Board' },
  { name: 'Ministry of Justice', code: 'JUSTICE', abbreviation: 'Justice' },
  { name: 'Customary Court of Appeal', code: 'CCA', abbreviation: 'CCA' },
  { name: 'Ministry of Agriculture', code: 'AGRICULTURE', abbreviation: 'Agriculture' },
  { name: 'Audit Service Commission', code: 'AUDIT SERVICE COMMISSION', abbreviation: 'Audit Service' },
  { name: 'Ministry of Culture and Tourism', code: 'CULTURE AND TOURISM', abbreviation: 'Culture & Tourism' },
  { name: 'Oyo State Fire Service Agency', code: 'FIRE', abbreviation: 'Fire Service' },
];

// Map old (incorrect) codes to new authoritative MDA codes for alias seeding
const OLD_CODE_ALIASES: Array<{ oldCode: string; newCode: string }> = [
  { oldCode: 'HLT', newCode: 'HEALTH' },
  { oldCode: 'EDU', newCode: 'EDUCATION' },
  { oldCode: 'WKT', newCode: 'WORKS AND TRANSPORT' },
  { oldCode: 'MOF', newCode: 'FINANCE' },
  { oldCode: 'MOA', newCode: 'AGRICULTURE' },
  { oldCode: 'MOJ', newCode: 'JUSTICE' },
  { oldCode: 'MTI', newCode: 'TRADE' },
  { oldCode: 'MIC', newCode: 'INFORMATION' },
  { oldCode: 'MEN', newCode: 'ENVIRONMENT' },
  { oldCode: 'MWA', newCode: 'WOMEN AFFAIRS' },
  { oldCode: 'MLH', newCode: 'LANDS AND HOUSING' },
  { oldCode: 'MLG', newCode: 'LOCAL GOVERNMENT' },
  { oldCode: 'MBE', newCode: 'BUDGET AND PLANNING' },
  { oldCode: 'MET', newCode: 'ESTABLISHMENT' },
  { oldCode: 'MYS', newCode: 'YOUTH AND SPORTS' },
  { oldCode: 'MER', newCode: 'ENERGY RESOURCES' },
  { oldCode: 'MSD', newCode: 'SPECIAL DUTIES' },
  { oldCode: 'IRS', newCode: 'BIR' },
  { oldCode: 'TSC', newCode: 'TESCOM' },
  { oldCode: 'HMB', newCode: 'OYSHMB' },
  { oldCode: 'OSBC', newCode: 'BCOS' },
  { oldCode: 'SWB', newCode: 'SPORTS COUNCIL' },
  { oldCode: 'UBE', newCode: 'SUBEB' },
  { oldCode: 'LIB', newCode: 'LIBRARY' },
  { oldCode: 'FRE', newCode: 'FIRE' },
  { oldCode: 'PHC', newCode: 'OYSPHB' },
  { oldCode: 'RMC', newCode: 'OYSROMA' },
  { oldCode: 'AGA', newCode: 'ACCOUNTANT GENERAL' },
  { oldCode: 'OHS', newCode: 'HOS' },
  { oldCode: 'GOV', newCode: 'GOVERNOR OFFICE' },
  { oldCode: 'OAG', newCode: 'AUDITOR GENERAL' },
  { oldCode: 'JSC', newCode: 'JUDICIAL COMMISSION' },
  { oldCode: 'SHA', newCode: 'ASSEMBLY COMMISSION' },
  { oldCode: 'WCA', newCode: 'WATER CORPORATION' },
  { oldCode: 'TVT', newCode: 'BOTAVED' },
  { oldCode: 'TRB', newCode: 'OYRTMA' },
  { oldCode: 'PCR', newCode: 'PENSIONS BOARD' },
  { oldCode: 'ASA', newCode: 'OYSADA' },
];

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
export async function runDemoSeed(): Promise<{ userCount: number; mdaCount: number; loanCount: number }> {
  const hashedPassword = await hashPassword(DEMO_PASSWORD);

  let mdaCount = 0;
  let userCount = 0;
  let loanCount = 0;

  await db.transaction(async (tx) => {
    // 1. Seed all 63 MDAs (idempotent via onConflictDoNothing on code)
    for (const mda of ALL_MDAS) {
      const [record] = await tx
        .insert(mdas)
        .values({
          id: generateUuidv7(),
          name: mda.name,
          code: mda.code,
          abbreviation: mda.abbreviation,
        })
        .onConflictDoNothing({ target: mdas.code })
        .returning();
      if (record) mdaCount++;
    }

    // 2. Lookup seeded MDA IDs for alias and user assignment
    const allMdaRows = await tx.select().from(mdas);
    const mdaMap = new Map<string, string>();
    for (const m of allMdaRows) {
      mdaMap.set(m.code, m.id);
    }

    // 3. Seed MDA aliases (old codes → new canonical MDAs)
    for (const { oldCode, newCode } of OLD_CODE_ALIASES) {
      if (oldCode === newCode) continue; // skip if same
      const mdaId = mdaMap.get(newCode);
      if (!mdaId) continue;
      // No target specified: unique index is on LOWER(alias) expression, which Drizzle can't target directly
      await tx
        .insert(mdaAliases)
        .values({ id: generateUuidv7(), mdaId, alias: oldCode })
        .onConflictDoNothing();
    }

    // 4. Seed demo user accounts using new authoritative MDA codes
    const healthMdaId = mdaMap.get('HEALTH') ?? null;
    const educationMdaId = mdaMap.get('EDUCATION') ?? null;

    const DEMO_USERS = [
      { email: 'ag@vlprs.oyo.gov.ng', firstName: 'Accountant', lastName: 'General', role: 'super_admin' as const, mdaId: null },
      { email: 'deputy.ag@vlprs.oyo.gov.ng', firstName: 'Deputy', lastName: 'AG', role: 'super_admin' as const, mdaId: null },
      { email: 'admin@vlprs.oyo.gov.ng', firstName: 'Department', lastName: 'Admin', role: 'dept_admin' as const, mdaId: null },
      { email: 'health.officer@vlprs.oyo.gov.ng', firstName: 'Health', lastName: 'Officer', role: 'mda_officer' as const, mdaId: healthMdaId },
      { email: 'education.officer@vlprs.oyo.gov.ng', firstName: 'Education', lastName: 'Officer', role: 'mda_officer' as const, mdaId: educationMdaId },
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
  });

  return { userCount, mdaCount, loanCount };
}

// CLI entry point — only runs when executed directly (not when imported)
const isDirectRun = process.argv[1]?.includes('seed-demo');
if (isDirectRun) {
  console.log('Seeding demo data...');
  runDemoSeed()
    .then(({ userCount, mdaCount, loanCount }) => {
      console.log(`Seeded ${userCount} users, ${mdaCount} MDAs, ${loanCount} loans`);
      console.log('Demo seed complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
