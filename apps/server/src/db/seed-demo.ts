import { db } from './index';
import { mdas, users } from './schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';

const DEMO_PASSWORD = process.env.DEMO_SEED_PASSWORD || 'DemoPass1';

// 3 full MDAs with complete metadata
const FULL_MDAS = [
  { name: 'Ministry of Health', code: 'HLT' },
  { name: 'Ministry of Education', code: 'EDU' },
  { name: 'Ministry of Works and Transport', code: 'WKT' },
];

// Remaining 60 name-only MDAs (real Oyo State MDA names)
const NAME_ONLY_MDAS = [
  { name: 'Ministry of Finance', code: 'MOF' },
  { name: 'Ministry of Agriculture and Rural Development', code: 'MOA' },
  { name: 'Ministry of Justice', code: 'MOJ' },
  { name: 'Ministry of Trade, Industry, Investment and Cooperatives', code: 'MTI' },
  { name: 'Ministry of Information, Culture and Tourism', code: 'MIC' },
  { name: 'Ministry of Environment', code: 'MEN' },
  { name: 'Ministry of Women Affairs, Community Development and Social Welfare', code: 'MWA' },
  { name: 'Ministry of Lands, Housing and Urban Development', code: 'MLH' },
  { name: 'Ministry of Local Government and Chieftaincy Affairs', code: 'MLG' },
  { name: 'Ministry of Budget and Economic Planning', code: 'MBE' },
  { name: 'Ministry of Establishments and Training', code: 'MET' },
  { name: 'Ministry of Youth and Sports', code: 'MYS' },
  { name: 'Ministry of Water Resources', code: 'MWR' },
  { name: 'Ministry of Energy and Mineral Resources', code: 'MER' },
  { name: 'Ministry of Science and Technology', code: 'MST' },
  { name: 'Ministry of Special Duties', code: 'MSD' },
  { name: 'Ministry of Home Affairs and Boundary Matters', code: 'MHA' },
  { name: 'Ministry of Religious Affairs', code: 'MRE' },
  { name: 'Ministry of Physical Planning and Urban Development', code: 'MPE' },
  { name: 'Ministry of Community and Poverty Alleviation', code: 'MCP' },
  { name: 'Ministry of Political Affairs and Inter-Governmental Relations', code: 'MPC' },
  { name: 'Ministry of Diaspora and Migration', code: 'MDR' },
  { name: 'Ministry of Inter-Religious Affairs', code: 'MIR' },
  { name: 'Office of the Head of Service', code: 'OHS' },
  { name: 'Bureau of Physical Planning and Development Control', code: 'BPP' },
  { name: 'Oyo State Internal Revenue Service', code: 'IRS' },
  { name: 'Oyo State Universal Basic Education Board', code: 'UBE' },
  { name: 'Teaching Service Commission', code: 'TSC' },
  { name: 'State Hospital Management Board', code: 'HMB' },
  { name: 'Judicial Service Commission', code: 'JSC' },
  { name: 'Civil Service Commission', code: 'CSC' },
  { name: 'Local Government Service Commission', code: 'LGS' },
  { name: 'Public Procurement Agency', code: 'PPA' },
  { name: 'Pension Commission Review Board', code: 'PCR' },
  { name: 'Office of the Secretary to the State Government', code: 'SSG' },
  { name: 'Office of the Auditor General', code: 'OAG' },
  { name: 'State House of Assembly Service Commission', code: 'SHA' },
  { name: 'Office of the Governor', code: 'GOV' },
  { name: 'Office of the Deputy Governor', code: 'DOG' },
  { name: 'Oyo State Broadcasting Corporation', code: 'OSBC' },
  { name: 'Water Corporation of Oyo State', code: 'WCA' },
  { name: 'Road Maintenance Agency', code: 'RMC' },
  { name: 'Solid Waste Management Authority', code: 'SMA' },
  { name: 'Fire Service', code: 'FRE' },
  { name: 'State Library Board', code: 'LIB' },
  { name: 'Ladoke Akintola University Teaching Hospital', code: 'LAUTECH' },
  { name: 'The Polytechnic, Ibadan', code: 'POLY' },
  { name: 'Emmanuel Alayande College of Education', code: 'COED' },
  { name: 'Agricultural Development Programme', code: 'ASA' },
  { name: 'State Sports Council', code: 'SWB' },
  { name: 'Oyo State Muslim Pilgrims Welfare Board', code: 'MSB' },
  { name: 'Christian Pilgrims Welfare Board', code: 'CPB' },
  { name: 'Oyo State Liaison Office, Lagos', code: 'NLB' },
  { name: 'Oyo State Liaison Office, Abuja', code: 'NAB' },
  { name: "Accountant General's Office", code: 'AGA' },
  { name: 'State Emergency Management Agency', code: 'DIS' },
  { name: 'Primary Healthcare Development Board', code: 'PHC' },
  { name: 'College of Agriculture, Igboora', code: 'COT' },
  { name: 'Transport Authority', code: 'TRB' },
  { name: 'Technical and Vocational Training Board', code: 'TVT' },
];

/**
 * Core seed logic — reusable by both CLI and dev auto-seed.
 * Idempotent: uses onConflictDoNothing for both MDAs and users.
 */
export async function runDemoSeed(): Promise<{ userCount: number; mdaCount: number }> {
  const hashedPassword = await hashPassword(DEMO_PASSWORD);
  const allMdaEntries = [...FULL_MDAS, ...NAME_ONLY_MDAS];

  let mdaCount = 0;
  let userCount = 0;

  await db.transaction(async (tx) => {
    // 1. Seed all 63 MDAs (idempotent via onConflictDoNothing on code)
    for (const mda of allMdaEntries) {
      const [record] = await tx
        .insert(mdas)
        .values({ id: generateUuidv7(), name: mda.name, code: mda.code })
        .onConflictDoNothing({ target: mdas.code })
        .returning();
      if (record) mdaCount++;
    }

    // 2. Lookup seeded MDA IDs for officer assignment
    const allMdaRows = await tx.select().from(mdas);
    const mdaMap = new Map<string, string>();
    for (const m of allMdaRows) {
      mdaMap.set(m.code, m.id);
    }

    const healthMdaId = mdaMap.get('HLT') ?? null;
    const educationMdaId = mdaMap.get('EDU') ?? null;

    // 3. Seed 5 demo user accounts (per AC7 specification)
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

    // 4. Mock loan records — skipped (loans table not yet created, Epic 2 scope)
    // TODO: Seed mock loan records when loans table is created in Epic 2
  });

  return { userCount, mdaCount };
}

// CLI entry point — only runs when executed directly (not when imported)
const isDirectRun = process.argv[1]?.includes('seed-demo');
if (isDirectRun) {
  console.log('Seeding demo data...');
  runDemoSeed()
    .then(({ userCount, mdaCount }) => {
      console.log(`Seeded ${userCount} users, ${mdaCount} MDAs`);
      console.log('Demo seed complete.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
