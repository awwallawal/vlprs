import { sql } from 'drizzle-orm';
import { db } from './index';
import { users } from './schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import { env } from '../config/env';

async function seedAccount(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: 'super_admin' | 'dept_admin',
): Promise<boolean> {
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${email})`);

  if (existing) {
    console.log(`${role} already exists: ${email}. Skipping.`);
    return false;
  }

  const hashedPassword = await hashPassword(password);

  await db.insert(users).values({
    id: generateUuidv7(),
    email,
    hashedPassword,
    firstName,
    lastName,
    role,
    mdaId: null,
  });

  console.log(`${role} created: ${email}`);
  return true;
}

async function seedProduction() {
  // Seed Super Admin (AG)
  if (env.SUPER_ADMIN_EMAIL && env.SUPER_ADMIN_PASSWORD) {
    await seedAccount(
      env.SUPER_ADMIN_EMAIL,
      env.SUPER_ADMIN_PASSWORD,
      env.SUPER_ADMIN_FIRST_NAME,
      env.SUPER_ADMIN_LAST_NAME,
      'super_admin',
    );
  } else {
    console.log('SUPER_ADMIN_EMAIL/PASSWORD not set. Skipping super admin seed.');
  }

  // Seed Department Admin
  if (env.DEPT_ADMIN_EMAIL && env.DEPT_ADMIN_PASSWORD) {
    await seedAccount(
      env.DEPT_ADMIN_EMAIL,
      env.DEPT_ADMIN_PASSWORD,
      env.DEPT_ADMIN_FIRST_NAME,
      env.DEPT_ADMIN_LAST_NAME,
      'dept_admin',
    );
  } else {
    console.log('DEPT_ADMIN_EMAIL/PASSWORD not set. Skipping dept admin seed.');
  }

  process.exit(0);
}

seedProduction().catch((err) => {
  console.error('Production seed failed:', err);
  process.exit(1);
});
