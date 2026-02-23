/**
 * Calculates password strength score (0-5) based on FR42 rules.
 * Shared between PasswordChangeScreen and ChangePasswordDialog.
 */
export function getPasswordStrength(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  return score;
}

export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'] as const;
export const STRENGTH_COLORS = ['', 'bg-destructive', 'bg-[#D4A017]', 'bg-[#D4A017]', 'bg-teal', 'bg-teal'] as const;
