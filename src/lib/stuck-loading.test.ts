import { describe, expect, it } from "vitest"
import { planStuckRefresh } from "@/lib/stuck-loading"

describe("planStuckRefresh", () => {
  const now = 100_000

  it("retries an empty card once the skeleton has been up for a few seconds", () => {
    const plan = planStuckRefresh({
      now,
      loadingSince: { "gemini-web": now - 8_000, codex: now - 1_000 },
      hasData: {},
      lastRetryAt: {},
    })
    expect(plan.retry).toEqual(["gemini-web"])
    expect(plan.giveUp).toEqual([])
  })

  it("does not retry again inside the gap", () => {
    const plan = planStuckRefresh({
      now,
      loadingSince: { "gemini-web": now - 12_000 },
      hasData: {},
      lastRetryAt: { "gemini-web": now - 3_000 },
    })
    expect(plan.retry).toEqual([])
    expect(plan.giveUp).toEqual([])
  })

  it("turns a first load that never returns into an error", () => {
    const plan = planStuckRefresh({
      now,
      loadingSince: { workbuddy: now - 45_000 },
      hasData: { workbuddy: false },
      lastRetryAt: { workbuddy: now - 8_000 },
    })
    expect(plan.giveUp).toEqual(["workbuddy"])
    expect(plan.retry).toEqual([])
  })

  it("keeps numbers on screen and only retries a long refresh", () => {
    const plan = planStuckRefresh({
      now,
      loadingSince: { hostdare: now - 45_000, qoder: now - 10_000 },
      hasData: { hostdare: true, qoder: true },
      lastRetryAt: {},
    })
    expect(plan.retry).toEqual(["hostdare"])
    expect(plan.giveUp).toEqual([])
  })
})
