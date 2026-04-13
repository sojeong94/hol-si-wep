import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// ─── User helpers ────────────────────────────────────────────────────────────

export async function upsertUser(params: {
  provider: string
  providerId: string
  email?: string | null
  name?: string | null
  avatar?: string | null
}) {
  return prisma.user.upsert({
    where: { provider_providerId: { provider: params.provider, providerId: params.providerId } },
    update: {
      email: params.email ?? undefined,
      name: params.name ?? undefined,
      avatar: params.avatar ?? undefined,
      lastLoginAt: new Date(),
    },
    create: {
      provider: params.provider,
      providerId: params.providerId,
      email: params.email,
      name: params.name,
      avatar: params.avatar,
    },
  })
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

export async function syncUserData(userId: string, data: {
  pillsData?: string
  recordsData?: string
  settingsData?: string
}) {
  return prisma.userData.upsert({
    where: { userId },
    update: {
      ...(data.pillsData !== undefined && { pillsData: data.pillsData }),
      ...(data.recordsData !== undefined && { recordsData: data.recordsData }),
      ...(data.settingsData !== undefined && { settingsData: data.settingsData }),
    },
    create: {
      userId,
      pillsData: data.pillsData,
      recordsData: data.recordsData,
      settingsData: data.settingsData,
    },
  })
}

export async function getUserData(userId: string) {
  return prisma.userData.findUnique({ where: { userId } })
}

export async function getAllUsers() {
  return prisma.user.findMany({
    orderBy: { lastLoginAt: 'desc' },
    include: { userData: true },
  })
}
