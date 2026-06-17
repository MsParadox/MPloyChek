// ============================================================
// MPloyChek v4.0 — AuthService (Priority 4)
// Extracts password hashing & verification business logic
// from auth routes into a proper service layer
// Author: Mohit Sharma
// ============================================================
import * as bcrypt from 'bcryptjs';
import { userRepo } from '../repositories/user.repository';
import { refreshTokenRepo } from '../repositories/index';
import logger from '../lib/logger';

const SALT_ROUNDS = 10;

export class AuthService {
  /**
   * Hash a plain-text password before storing
   * (business logic belongs in service, not repository)
   */
  async hashPassword(plainText: string): Promise<string> {
    return bcrypt.hash(plainText, SALT_ROUNDS);
  }

  /**
   * Verify a plain-text password against a stored hash
   */
  async verifyPassword(plainText: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainText, hash);
  }

  /**
   * Register a new user with hashed password
   */
  async registerUser(userData: {
    userId: string; firstName: string; lastName: string;
    email: string; password: string; role: string;
    department: string; phone: string;
  }) {
    // 1. Check uniqueness
    const [existingByEmail, existingByUserId] = await Promise.all([
      userRepo.findByEmail(userData.email),
      userRepo.findByUserId(userData.userId),
    ]);

    if (existingByEmail) throw new Error('Email is already registered');
    if (existingByUserId) throw new Error('User ID is already taken');

    // 2. Hash password at the service boundary (Priority 4 requirement)
    const { password, ...safeData } = userData;
    const passwordHash = await this.hashPassword(password);

    // 3. Create user — repository receives safe data only (never plaintext password)
    const newUser = await userRepo.create({
      ...safeData,
      passwordHash,
    });

    logger.info('✅ User registered', { userId: userData.userId, role: userData.role });
    return newUser;
  }

  /**
   * Verify credentials for login
   */
  async verifyCredentials(userId: string, plainTextPassword: string) {
    const user = await userRepo.findByUserId(userId);
    if (!user) return null;

    const isValid = await this.verifyPassword(plainTextPassword, user.passwordHash);
    return isValid ? user : null;
  }

  /**
   * Change password — revoke all sessions on success
   */
  async changePassword(userDbId: string, userId: string, currentPassword: string, newPassword: string) {
    const user = await userRepo.findByUserId(userId);
    if (!user) throw new Error('User not found');

    const isValid = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) throw new Error('Current password is incorrect');

    const passwordHash = await this.hashPassword(newPassword);
    await userRepo.update(user.id, { passwordHash });

    // Revoke all refresh tokens — force re-login on all devices
    await refreshTokenRepo.revokeAllForUser(userDbId);

    logger.info('🔐 Password changed, all sessions revoked', { userId });
    return true;
  }
}

export const authService = new AuthService();
