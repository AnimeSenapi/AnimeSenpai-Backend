import { z } from 'zod'
import { router, publicProcedure, protectedProcedure } from '../lib/trpc.js'
import { requireAdmin } from '../lib/roles.js'
import { db } from '../lib/db.js'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * App Status Router
 * 
 * Provides a simple global status badge configuration.
 * Persists to data/app-status.json (no schema change, survives restarts).
 */

// In-memory fallback store (used only if DB unavailable)
type BadgeConfig = {
  status: string
  enabled: boolean
  tooltip?: string
  pulse?: boolean
}

let appStatusBadge: BadgeConfig = {
  status: 'none',
  enabled: false,
  pulse: true,
}

// File storage (no migration, global persistence on a single instance)
const CONFIG_DIR = path.join(process.cwd(), 'data')
const CONFIG_PATH = path.join(CONFIG_DIR, 'app-status.json')

async function loadFromFile(): Promise<BadgeConfig | null> {
  try {
    const buf = await fs.readFile(CONFIG_PATH, 'utf8')
    const obj = JSON.parse(buf) as Partial<BadgeConfig>
    if (!obj || typeof obj.status !== 'string') return null
    return {
      status: obj.status,
      enabled: obj.enabled ?? obj.status !== 'none',
      ...(typeof obj.tooltip === 'string' ? { tooltip: obj.tooltip } : {}),
      pulse: obj.pulse ?? true,
    }
  } catch {
    return null
  }
}

async function saveToFile(badge: BadgeConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true })
  const toSave = {
    status: badge.status,
    enabled: badge.enabled,
    ...(badge.tooltip ? { tooltip: badge.tooltip } : {}),
    pulse: badge.pulse ?? true,
  }
  await fs.writeFile(CONFIG_PATH, JSON.stringify(toSave, null, 2), 'utf8')
}

export const appStatusRouter = router({
  /**
   * Get current app status badge configuration
   */
  getBadge: publicProcedure.query(async () => {
    // 1) File store
    const fileCfg = await loadFromFile()
    if (fileCfg) return fileCfg

    // 2) DB presence ensures settings row exists (no schema writes)
    try {
      let settings = await db.systemSettings.findFirst()
      if (!settings) {
        settings = await db.systemSettings.create({ data: {} })
      }
      // No-op read; falls through to default if file not present
      return { status: 'none', enabled: false, pulse: true }
    } catch {
      // ignore and fall back
    }
    // Fallback to in-memory storage if DB fields not available
    return appStatusBadge
  }),

  /**
   * Set app status badge configuration (admin only)
   */
  setBadge: protectedProcedure
    .input(z.object({
      status: z.string().min(0),
      enabled: z.boolean(),
      tooltip: z.string().optional(),
      pulse: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Require admin access
      requireAdmin(ctx.user.role)

      // Build next config
      const nextBadge: BadgeConfig = {
        status: input.status,
        enabled: input.enabled,
        ...(typeof input.tooltip === 'string' ? { tooltip: input.tooltip } : {}),
        pulse: input.pulse ?? true,
      }

      // Try to persist using file store first; if it fails, fall back to memory
      await saveToFile(nextBadge).catch(() => {
        appStatusBadge = nextBadge
      })

      return { ok: true }
    }),
})


