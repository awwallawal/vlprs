#!/usr/bin/env tsx
/**
 * CLI: Create a Super Admin account.
 *
 * Usage:
 *   pnpm user:create-admin --email ag@vlprs.oyo.gov.ng --name "Accountant General"
 *
 * The temporary password is displayed in the terminal (never emailed).
 * The account will have mustChangePassword = true.
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users } from '../db/schema';
import { hashPassword, generateTemporaryPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import { logAuthEvent } from '../services/auditService';
import { ROLES } from '@vlprs/shared';

function parseArgs(argv: string[]): { email: string; name: string } {
  let email = '';
  let name = '';

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      email = argv[++i];
    } else if (argv[i] === '--name' && argv[i + 1]) {
      name = argv[++i];
    }
  }

  if (!email || !name) {
    console.error('Usage: pnpm user:create-admin --email <email> --name "<Full Name>"');
    process.exit(1);
  }

  return { email, name };
}

async function main() {
  const { email, name } = parseArgs(process.argv);

  // Split name into first/last
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || firstName;

  // Check for duplicate email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${email})`);

  if (existing) {
    console.error(`Error: An account with email "${email}" already exists.`);
    process.exit(1);
  }

  // Generate temporary password
  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(temporaryPassword);

  // Insert super_admin user
  const [newUser] = await db
    .insert(users)
    .values({
      id: generateUuidv7(),
      email,
      hashedPassword,
      firstName,
      lastName,
      role: ROLES.SUPER_ADMIN,
      mdaId: null,
      mustChangePassword: true,
    })
    .returning();

  // Audit log as SYSTEM_CLI actor
  void logAuthEvent({
    userId: newUser.id,
    email: newUser.email,
    role: ROLES.SUPER_ADMIN,
    action: 'USER_CREATE_SUPER_ADMIN',
    resource: 'CLI:user:create-admin',
    method: 'CLI',
    responseStatus: 201,
    ipAddress: '127.0.0.1',
    userAgent: 'SYSTEM_CLI',
  });

  console.log('');
  console.log('Super Admin account created successfully.');
  console.log('');
  console.log(`  Email:              ${email}`);
  console.log(`  Name:               ${firstName} ${lastName}`);
  console.log(`  Temporary Password: ${temporaryPassword}`);
  console.log('');
  console.log('The user must change this password on first login.');
  console.log('Communicate this password in person — it will NOT be emailed.');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to create super admin:', err.message);
  process.exit(1);
});
