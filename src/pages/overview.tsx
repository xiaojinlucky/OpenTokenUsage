import { useCallback } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { ProviderCard } from "@/components/provider-card"
import type { PluginDisplayState } from "@/lib/plugin-types"
import type { DisplayMode, ResetTimerDisplayMode, TimeFormatMode } from "@/lib/settings"
import { t } from "@/lib/i18n"

interface OverviewPageProps {
  plugins: PluginDisplayState[]
  onRetryPlugin?: (pluginId: string) => void
  onReorder?: (orderedIds: string[]) => void
  displayMode: DisplayMode
  resetTimerDisplayMode: ResetTimerDisplayMode
  timeFormatMode?: TimeFormatMode
  onResetTimerDisplayModeToggle?: () => void
}

function SortableOverviewCard({
  plugin,
  showSeparator,
  onRetryPlugin,
  displayMode,
  resetTimerDisplayMode,
  timeFormatMode,
  onResetTimerDisplayModeToggle,
}: {
  plugin: PluginDisplayState
  showSeparator: boolean
  onRetryPlugin?: (pluginId: string) => void
  displayMode: DisplayMode
  resetTimerDisplayMode: ResetTimerDisplayMode
  timeFormatMode: TimeFormatMode
  onResetTimerDisplayModeToggle?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plugin.meta.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    position: "relative" as const,
    zIndex: isDragging ? 1 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ProviderCard
        name={plugin.meta.name}
        pluginId={plugin.meta.id}
        statusPageUrl={plugin.meta.statusPageUrl}
        plan={plugin.data?.plan}
        showSeparator={showSeparator}
        loading={plugin.loading}
        error={plugin.error}
        lines={plugin.data?.lines ?? []}
        skeletonLines={plugin.meta.lines}
        lastManualRefreshAt={plugin.lastManualRefreshAt}
        lastUpdatedAt={plugin.lastUpdatedAt}
        onRetry={onRetryPlugin ? () => onRetryPlugin(plugin.meta.id) : undefined}
        scopeFilter="overview"
        displayMode={displayMode}
        resetTimerDisplayMode={resetTimerDisplayMode}
        timeFormatMode={timeFormatMode}
        onResetTimerDisplayModeToggle={onResetTimerDisplayModeToggle}
      />
    </div>
  )
}

export function OverviewPage({
  plugins,
  onRetryPlugin,
  onReorder,
  displayMode,
  resetTimerDisplayMode,
  timeFormatMode = "auto",
  onResetTimerDisplayModeToggle,
}: OverviewPageProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!onReorder) return
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = plugins.findIndex((plugin) => plugin.meta.id === active.id)
      const newIndex = plugins.findIndex((plugin) => plugin.meta.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      onReorder(arrayMove(plugins, oldIndex, newIndex).map((plugin) => plugin.meta.id))
    },
    [onReorder, plugins]
  )

  if (plugins.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        {t("overview.noProviders")}
      </div>
    )
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={plugins.map((plugin) => plugin.meta.id)} strategy={verticalListSortingStrategy}>
        {plugins.map((plugin, index) => (
          <SortableOverviewCard
            key={plugin.meta.id}
            plugin={plugin}
            showSeparator={index < plugins.length - 1}
            onRetryPlugin={onRetryPlugin}
            displayMode={displayMode}
            resetTimerDisplayMode={resetTimerDisplayMode}
            timeFormatMode={timeFormatMode}
            onResetTimerDisplayModeToggle={onResetTimerDisplayModeToggle}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}
