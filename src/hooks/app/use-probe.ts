import { useCallback, useEffect, useRef } from "react"
import { useProbeEvents } from "@/hooks/use-probe-events"
import {
  type AutoUpdateIntervalMinutes,
  type PluginSettings,
} from "@/lib/settings"
import { useProbeAutoUpdate } from "@/hooks/app/use-probe-auto-update"
import { useProbeRefreshActions } from "@/hooks/app/use-probe-refresh-actions"
import { useProbeState } from "@/hooks/app/use-probe-state"
import { planStuckRefresh } from "@/lib/stuck-loading"

type UseProbeArgs = {
  pluginSettings: PluginSettings | null
  autoUpdateInterval: AutoUpdateIntervalMinutes
  onProbeResult?: () => void
}

export function useProbe({
  pluginSettings,
  autoUpdateInterval,
  onProbeResult,
}: UseProbeArgs) {
  const {
    pluginStates,
    pluginStatesRef,
    manualRefreshIdsRef,
    loadingSinceRef,
    setLoadingForPlugins,
    setErrorForPlugins,
    handleProbeResult,
  } = useProbeState({ onProbeResult })

  const lastStuckRetryAtRef = useRef<Record<string, number>>({})

  const handleBatchComplete = useCallback(() => {}, [])

  const { startBatch } = useProbeEvents({
    onResult: handleProbeResult,
    onBatchComplete: handleBatchComplete,
  })

  useEffect(() => {
    const timer = setInterval(() => {
      const states = pluginStatesRef.current
      const hasData: Record<string, boolean> = {}
      for (const id of Object.keys(loadingSinceRef.current)) {
        if (!states[id]?.loading) {
          delete loadingSinceRef.current[id]
          continue
        }
        hasData[id] = states[id]?.data != null
      }
      const plan = planStuckRefresh({
        now: Date.now(),
        loadingSince: loadingSinceRef.current,
        hasData,
        lastRetryAt: lastStuckRetryAtRef.current,
      })
      if (plan.giveUp.length > 0) {
        setErrorForPlugins(plan.giveUp, "Couldn't update data. Try again?")
      }
      if (plan.retry.length === 0) return
      const now = Date.now()
      for (const id of plan.retry) lastStuckRetryAtRef.current[id] = now
      setLoadingForPlugins(plan.retry)
      startBatch(plan.retry).catch((error) => {
        console.error("Failed to retry a stuck probe:", error)
        setErrorForPlugins(plan.retry, "Couldn't update data. Try again?")
      })
    }, 2_000)
    return () => clearInterval(timer)
  }, [loadingSinceRef, pluginStatesRef, setErrorForPlugins, setLoadingForPlugins, startBatch])

  const isPluginLoading = useCallback(
    (id: string) => Boolean(pluginStatesRef.current[id]?.loading),
    [pluginStatesRef]
  )

  const {
    autoUpdateNextAt,
    setAutoUpdateNextAt,
    resetAutoUpdateSchedule,
  } = useProbeAutoUpdate({
    pluginSettings,
    autoUpdateInterval,
    setLoadingForPlugins,
    setErrorForPlugins,
    isPluginLoading,
    startBatch,
  })

  const { handleRetryPlugin, handleRefreshAll } = useProbeRefreshActions({
    pluginSettings,
    pluginStatesRef,
    manualRefreshIdsRef,
    resetAutoUpdateSchedule,
    setLoadingForPlugins,
    setErrorForPlugins,
    startBatch,
  })

  return {
    pluginStates,
    setLoadingForPlugins,
    setErrorForPlugins,
    startBatch,
    autoUpdateNextAt,
    setAutoUpdateNextAt,
    handleRetryPlugin,
    handleRefreshAll,
  }
}
