#!/usr/bin/env tsx
/**
 * CLI: Deactivate a Super Admin account.
 *
 * Usage:
 *   pnpm user:deactivate-admin --email deputy.ag@vlprs.oyo.gov.ng
 *
 * Requires interactive confirmation (type the email again).
 * Refuses if the target is the last active super admin.
 */
import { eq, and, isNull, sql, count } from 'drizzle-orm';
import { db } from '../db/index';
import { users, refreshTokens } from '../db/schema';
import { logAuthEvent } from '../services/auditService';
import { ROLES, VOCABULARY } from '@vlprs/shared';
import { createInterface } from 'readline';

function parseArgs(argv: string[]): { email: string } {
  let email = '';

  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      email = argv[++i];
    }
  }

  if (!email) {
    console.error('Usage: pnpm user:deactivate-admin --email <email>');
    process.exit(1);
  }

  return { email };
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const { email } = parseArgs(process.argv);

  // Find the super_admin user
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        sql`LOWER(${users.email}) = LOWER(${email})`,
        eq(users.role, ROLES.SUPER_ADMIN),
        isNull(users.deletedAt),
      ),
    );

  if (!user) {
    console.error(`Error: No active super admin account found with email "${email}".`);
    process.exit(1);
  }

  if (!user.isActive) {
    console.error(`Error: Super admin account "${email}" is already deactivated.`);
    process.exit(1);
  }

  // Last super_admin guard
  const [{ value: activeCount }] = await db
    .select({ value: count() })
    .from(users)
    .where(
      and(
        eq(users.role, ROLES.SUPER_ADMIN),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  if (Number(activeCount) <= 1) {
    console.error(`Error: ${VOCABULARY.LAST_SUPER_ADMIN}`);
    process.exit(1);
  }

  // Interactive confirmation
  console.log('');
  console.log('You are about to deactivate a Super Admin account.');
  console.log(`  Email: ${user.email}`);
  console.log(`  Name:  ${user.firstName} ${user.lastName}`);
  console.log('');

  const confirmation = await prompt('Type the email again to confirm: ');
  if (confirmation.toLowerCase() !== email.toLowerCase()) {
    console.error('Confirmation does not match. Deactivation aborted.');
    process.exit(1);
  }

  // Deactivate
  await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  // Revoke all tokens
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, user.id),
        isNull(refreshTokens.revokedAt),
      ),
    );

  // Audit log as SYSTEM_CLI actor
  void logAuthEvent({
    userId: user.id,
    email: user.email,
    role: ROLES.SUPER_ADMIN,
    action: 'USER_DEACTIVATE_SUPER_ADMIN',
    resource: 'CLI:user:deactivate-admin',
    method: 'CLI',
    responseStatus: 200,
    ipAddress: '127.0.0.1',
    userAgent: 'SYSTEM_CLI',
  });

  console.log('');
  console.log(`Super Admin account "${email}" has been deactivated.`);
  console.log('All sessions have been terminated.');
  console.log('');

  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to deactivate super admin:', err.message);
  process.exit(1);
});
