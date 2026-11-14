import * as bcrypt from 'bcryptjs';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (!hash || !plain) return false;
  try {
    // If it's a bcrypt hash
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
      return await bcrypt.compare(plain, hash);
    }
    // Fallback direct string match or simple format
    if (hash === plain) {
      return true;
    }
    // Fallback attempt bcrypt compare
    return await bcrypt.compare(plain, hash);
  } catch {
    return hash === plain;
  }
}
