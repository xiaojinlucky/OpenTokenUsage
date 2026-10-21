import type { DisplayMode } from "@/lib/settings"
import { clamp01 } from "@/lib/utils"

/** A count line that already names both numbers. The global 剩余/已用 switch does not apply. */
export function fixedCountCaptions(format: {
  kind: string
  primaryCaption?: string
  secondaryCaption?: string
}): { primary: string; secondary: string } | null {
  if (format.kind !== "count") return null
  const primary = format.primaryCaption?.trim()
  const secondary = format.secondaryCaption?.trim()
  if (!primary || !secondary) return null
  return { primary, secondary }
}

/** One conversion for every surface; alert thresholds still use raw consumed usage. */
export function getDisplayedUsage(used: number, limit: number, mode: DisplayMode) {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) {
    return { amount: 0, fraction: 0 }
  }
  const amount = mode === "left" ? Math.max(0, limit - used) : used
  return { amount, fraction: clamp01(amount / limit) }
}
