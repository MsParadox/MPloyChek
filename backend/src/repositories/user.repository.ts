// ============================================================
// MPloyChek v4.0 — User Repository (Prisma)
// FIX Priority 1: Import enums from @prisma/client (not manual const)
// Author: Mohit Sharma
// ============================================================
import { UserRole, UserStatus } from '@prisma/client';  // ← FIX: Direct Prisma import
import prisma from '../lib/prisma';

// ── Role mapping helpers ──────────────────────────────────────
export const apiRoleToEnum = (r: string): UserRole => (({
  'Admin': UserRole.ADMIN, 'Manager': UserRole.MANAGER,
  'Verifier': UserRole.VERIFIER, 'General User': UserRole.GENERAL_USER,
} as Record<string, UserRole>)[r] ?? UserRole.GENERAL_USER);

export const enumRoleToApi = (r: UserRole): string => ({
  [UserRole.ADMIN]: 'Admin', [UserRole.MANAGER]: 'Manager',
  [UserRole.VERIFIER]: 'Verifier', [UserRole.GENERAL_USER]: 'General User',
}[r]);

export const apiStatusToEnum = (s: string): UserStatus => (({
  'Active': UserStatus.ACTIVE, 'Inactive': UserStatus.INACTIVE,
  'Suspended': UserStatus.SUSPENDED, 'Pending': UserStatus.PENDING,
} as Record<string, UserStatus>)[s] ?? UserStatus.ACTIVE);

export const enumStatusToApi = (s: UserStatus): string => ({
  [UserStatus.ACTIVE]: 'Active', [UserStatus.INACTIVE]: 'Inactive',
  [UserStatus.SUSPENDED]: 'Suspended', [UserStatus.PENDING]: 'Pending',
}[s]);

// ── Serialize user to API shape ───────────────────────────────
export function serializeUser(u: any) {
  return {
    id:        u.id,
    userId:    u.userId,
    firstName: u.firstName,
    lastName:  u.lastName,
    email:     u.email,
    role:      enumRoleToApi(u.role),
    department:u.department,
    phone:     u.phone,
    bio:       u.bio ?? undefined,
    // FIX Priority 2: joinDate is now DateTime — serialize to ISO string
    joinDate:  u.joinDate instanceof Date
      ? u.joinDate.toISOString().split('T')[0]
      : u.joinDate,
    status:    enumStatusToApi(u.status),
    lastLogin: u.lastLogin instanceof Date ? u.lastLogin.toISOString() : null,
    preferences: {
      theme:              u.theme,
      emailNotifications: u.emailNotifications,
      smsNotifications:   u.smsNotifications,
      language:           u.language,
    },
  };
}

export class UserRepository {
  async findAll() {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(serializeUser);
  }

  async findById(id: string) {
    const u = await prisma.user.findUnique({ where: { id } });
    return u ? serializeUser(u) : null;
  }

  async findByUserId(userId: string) {
    return prisma.user.findUnique({ where: { userId } });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async create(data: {
    userId: string; firstName: string; lastName: string;
    email: string; passwordHash: string; role: string;
    department: string; phone: string;
  }) {
    const user = await prisma.user.create({
      data: {
        userId:      data.userId,
        firstName:   data.firstName,
        lastName:    data.lastName,
        email:       data.email,
        passwordHash:data.passwordHash,
        role:        apiRoleToEnum(data.role),
        department:  data.department,
        phone:       data.phone,
        joinDate:    new Date(), // FIX: DateTime, not string
      },
    });
    return serializeUser(user);
  }

  async update(id: string, data: {
    firstName?: string; lastName?: string; email?: string;
    role?: string; department?: string; phone?: string;
    status?: string; bio?: string; lastLogin?: Date;
    passwordHash?: string;
    preferences?: { emailNotifications?: boolean; smsNotifications?: boolean; language?: string; theme?: string; };
  }) {
    const patch: Record<string, any> = {};
    if (data.firstName   !== undefined) patch.firstName   = data.firstName;
    if (data.lastName    !== undefined) patch.lastName    = data.lastName;
    if (data.email       !== undefined) patch.email       = data.email;
    if (data.department  !== undefined) patch.department  = data.department;
    if (data.phone       !== undefined) patch.phone       = data.phone;
    if (data.bio         !== undefined) patch.bio         = data.bio;
    if (data.lastLogin   !== undefined) patch.lastLogin   = data.lastLogin;
    if (data.passwordHash !== undefined) patch.passwordHash = data.passwordHash;
    if (data.role        !== undefined) patch.role        = apiRoleToEnum(data.role);
    if (data.status      !== undefined) patch.status      = apiStatusToEnum(data.status);
    if (data.preferences) {
      if (data.preferences.emailNotifications !== undefined) patch.emailNotifications = data.preferences.emailNotifications;
      if (data.preferences.smsNotifications   !== undefined) patch.smsNotifications   = data.preferences.smsNotifications;
      if (data.preferences.language           !== undefined) patch.language           = data.preferences.language;
      if (data.preferences.theme              !== undefined) patch.theme              = data.preferences.theme;
    }

    const user = await prisma.user.update({ where: { id }, data: patch });
    return serializeUser(user);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({ where: { id } });
      return true;
    } catch { return false; }
  }

  async getStats() {
    // FIX Priority 1: Use UserRole/UserStatus enum from @prisma/client
    const [total, active, admins, records, candidates, pending, completed, inProgress, failed] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.record.count(),
      prisma.candidate.count(),
      prisma.record.count({ where: { status: 'PENDING' } }),
      prisma.record.count({ where: { status: 'COMPLETED' } }),
      prisma.record.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.record.count({ where: { status: 'FAILED' } }),
    ]);
    return {
      totalUsers: total, activeUsers: active, adminUsers: admins,
      totalRecords: records, totalCandidates: candidates,
      pendingRecords: pending, completedRecords: completed,
      inProgressRecords: inProgress, failedRecords: failed,
    };
  }
}

export const userRepo = new UserRepository();
