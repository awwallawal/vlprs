import { sql } from 'drizzle-orm';
import { db } from './index';
import { users } from './schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import { env } from '../config/env';

async function seedProduction() {
  const email = env.SUPER_ADMIN_EMAIL;
  const password = env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }

  // Idempotent: skip if super admin already exists
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${email})`);

  if (existing) {
    console.log(`Super admin already exists: ${email}. Skipping.`);
    process.exit(0);
  }

  const hashedPassword = await hashPassword(password);

  await db.insert(users).values({
    id: generateUuidv7(),
    email,
    hashedPassword: hashedPassword,
    firstName: env.SUPER_ADMIN_FIRST_NAME,
    lastName: env.SUPER_ADMIN_LAST_NAME,
    role: 'super_admin',
    mdaId: null,
  });

  console.log(`Super admin created: ${email}`);
  process.exit(0);
}

seedProduction().catch((err) => {
  console.error('Production seed failed:', err);
  process.exit(1);
});
