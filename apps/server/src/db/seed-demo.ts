import { db } from './index';
import { mdas, users } from './schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';

const DEMO_PASSWORD = 'Password1';

const DEMO_MDAS = [
  { name: 'Ministry of Finance', code: 'MOF' },
  { name: 'Ministry of Education', code: 'MOE' },
  { name: 'Ministry of Health', code: 'MOH' },
] as const;

async function seedDemo() {
  console.log('Seeding demo data...');

  const hashedPassword = await hashPassword(DEMO_PASSWORD);

  // Insert MDAs
  const mdaRecords: { id: string; name: string; code: string }[] = [];
  for (const mda of DEMO_MDAS) {
    const [record] = await db
      .insert(mdas)
      .values({ id: generateUuidv7(), name: mda.name, code: mda.code })
      .onConflictDoNothing({ target: mdas.code })
      .returning();
    if (record) {
      mdaRecords.push(record);
      console.log(`  MDA created: ${mda.name} (${mda.code})`);
    } else {
      console.log(`  MDA already exists: ${mda.name} (${mda.code})`);
    }
  }

  // Resolve MDA IDs by code
  const mdaMap = new Map<string, string>();
  const allMdas = await db.select().from(mdas);
  for (const m of allMdas) {
    mdaMap.set(m.code, m.id);
  }

  const DEMO_USERS = [
    { email: 'super.admin@vlprs.test', firstName: 'Super', lastName: 'Admin', role: 'super_admin' as const, mdaId: null },
    { email: 'dept.admin@vlprs.test', firstName: 'Dept', lastName: 'Admin', role: 'dept_admin' as const, mdaId: null },
    { email: 'finance.officer@vlprs.test', firstName: 'Finance', lastName: 'Officer', role: 'mda_officer' as const, mdaId: mdaMap.get('MOF') ?? null },
    { email: 'education.officer@vlprs.test', firstName: 'Education', lastName: 'Officer', role: 'mda_officer' as const, mdaId: mdaMap.get('MOE') ?? null },
    { email: 'health.officer@vlprs.test', firstName: 'Health', lastName: 'Officer', role: 'mda_officer' as const, mdaId: mdaMap.get('MOH') ?? null },
  ];

  for (const user of DEMO_USERS) {
    const [record] = await db
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
    if (record) {
      console.log(`  User created: ${user.email} (${user.role})`);
    } else {
      console.log(`  User already exists: ${user.email} (${user.role})`);
    }
  }

  console.log('Demo seed complete.');
  process.exit(0);
}

seedDemo().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
