/** A card with no numbers yet should not sit on a skeleton for a whole refresh interval. */
export const STUCK_EMPTY_RETRY_MS = 8_000
/** A card that already has numbers can stay on "refreshing" until a slow probe should have finished. */
export const STUCK_REFRESH_RETRY_MS = 45_000
/** First load that never returns becomes an error, so the retry button works again. */
export const STUCK_GIVE_UP_MS = 45_000
export const STUCK_RETRY_GAP_MS = 8_000

export function planStuckRefresh(input: {
  now: number
  loadingSince: Record<string, number>
  hasData: Record<string, boolean>
  lastRetryAt: Record<string, number>
}): { retry: string[]; giveUp: string[] } {
  const retry: string[] = []
  const giveUp: string[] = []
  for (const [id, since] of Object.entries(input.loadingSince)) {
    const age = input.now - since
    const hasData = input.hasData[id] === true
    if (!hasData && age >= STUCK_GIVE_UP_MS) {
      giveUp.push(id)
      continue
    }
    const due = hasData ? age >= STUCK_REFRESH_RETRY_MS : age >= STUCK_EMPTY_RETRY_MS
    if (!due) continue
    const last = input.lastRetryAt[id] ?? 0
    if (input.now - last < STUCK_RETRY_GAP_MS) continue
    retry.push(id)
  }
  return { retry, giveUp }
}
