// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFAULT_TIMELINE_HEIGHT,
  TimelineActions,
  TimelineController,
  TimelineRuler,
  TimelineToolbar,
  TreeTable,
  nanosToMs,
  type Column,
  type NvtxTreeEntity,
  type TreeTableItem,
} from '@quent/components';
import { useHydrateTimelineAtoms } from '@quent/hooks';
import type {
  EntityRef,
  EntityTypeValue,
  QueryBundle,
  SingleTimelineResponse,
  ZoomRange,
} from '@quent/utils';
import { useTheme, THEME_DARK } from '@/contexts/ThemeContext';
import { useTabActionSlots } from '@/components/TabActionSlots';
import { PinnableRowLabel } from './PinnableRowLabel';

export type TimelineTreeItem = TreeTableItem<EntityTypeValue | NvtxTreeEntity>;

// Extra information a row label can show.
export interface RowLabelContext {
  // The worker the row belongs to; given for rows in the pinned section.
  workerName?: string;
}

export interface TimelineTreeModel {
  trees: TimelineTreeItem[];
  renderLabel: (item: TimelineTreeItem, context?: RowLabelContext) => ReactNode;
  renderTimeline: (item: TimelineTreeItem) => ReactNode;
  // Rows a user can pin. Trees that leave these out have no pin buttons.
  isPinnable?: (item: TimelineTreeItem) => boolean;
  // Plain-text name of a row, used to label its pin button.
  getRowName?: (item: TimelineTreeItem) => string;
}

export interface TimelineTreeControls {
  emptyMessage?: string;
  filters?: ReactNode;
  initialSelectedItemId?: string;
  expandedIds: Set<string>;
  highlightedItemIds?: Set<string>;
  indicatorItemIds?: Set<string>;
  timelineData?: SingleTimelineResponse;
  onExpandChange: (itemId: string, isExpanded: boolean) => void;
  onZoomChange?: (range: ZoomRange) => void;
  // Pinned rows to show above the tree, after any filter has been applied.
  pinnedItems?: TimelineTreeItem[];
  // Pinned rows that a filter currently hides.
  hiddenPinnedCount?: number;
  pinnedIds?: ReadonlySet<string>;
  // Name of the worker each row belongs to, keyed by row id.
  workerLabels?: ReadonlyMap<string, string>;
  isAtPinLimit?: boolean;
  onTogglePin?: (itemId: string) => void;
  // Whether the pinned section shows only its header.
  isPinnedCollapsed?: boolean;
  onTogglePinnedCollapsed?: () => void;
  // A request to select a row and scroll the tree to it; handled once per token.
  revealItem?: { id: string; token: number };
  onRevealPinned?: (itemId: string) => void;
}

interface TimelineTreeTableProps {
  durationSeconds: number;
  isDark: boolean;
  trees: TimelineTreeModel[];
  controls: TimelineTreeControls;
  children?: ReactNode;
}

function indexTree(
  item: TimelineTreeItem,
  model: TimelineTreeModel,
  modelsByItemId: Map<string, TimelineTreeModel>
) {
  modelsByItemId.set(item.id, model);
  for (const child of item.children ?? []) {
    indexTree(child, model, modelsByItemId);
  }
}

// Standalone and combined tree containers share identical timeline setup.

export function useTimelineTreeSetup(
  queryBundle: QueryBundle<EntityRef>,
  initialZoomRange?: ZoomRange
) {
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const durationSeconds = queryBundle.duration_s;
  const defaultZoomRange = { start: 0, end: durationSeconds };
  const startTimeMs = useMemo(
    () => nanosToMs(queryBundle.start_time_unix_ns),
    [queryBundle.start_time_unix_ns]
  );

  useHydrateTimelineAtoms({
    zoomRange: initialZoomRange ?? defaultZoomRange,
    debouncedZoomRange: initialZoomRange ?? defaultZoomRange,
    startTimeMs,
  });

  return { durationSeconds, isDark };
}

export function TimelineTreeTable({
  durationSeconds,
  isDark,
  trees,
  controls,
  children,
}: TimelineTreeTableProps) {
  const slots = useTabActionSlots();
  const { data, modelsByItemId } = useMemo(() => {
    const modelsByItemId = new Map<string, TimelineTreeModel>();
    const data: TimelineTreeItem[] = [];
    for (const model of trees) {
      for (const tree of model.trees) {
        data.push(tree);
        indexTree(tree, model, modelsByItemId);
      }
    }
    return { data, modelsByItemId };
  }, [trees]);
  const { isAtPinLimit, onTogglePin, pinnedIds, workerLabels } = controls;
  const columns = useMemo(
    () =>
      [
        {
          key: 'resource',
          label: 'Resource',
          widthIndex: 0,
          isFirst: true,
          headerContent: (
            <div className="flex h-full select-none items-center px-3 text-xs font-semibold text-muted-foreground">
              Resource
            </div>
          ),
          render: ({ item, isPinned }: { item: TimelineTreeItem; isPinned?: boolean }) => {
            const model = modelsByItemId.get(item.id);
            return (
              <PinnableRowLabel
                label={
                  model?.renderLabel(item, {
                    workerName: isPinned ? workerLabels?.get(item.id) : undefined,
                  }) ?? null
                }
                name={model?.getRowName?.(item) ?? item.id}
                isPinnable={onTogglePin != null && (model?.isPinnable?.(item) ?? false)}
                isPinned={pinnedIds?.has(item.id) ?? false}
                isAtPinLimit={isAtPinLimit ?? false}
                onTogglePin={() => onTogglePin?.(item.id)}
              />
            );
          },
        },
        {
          key: 'usage',
          label: 'Usage',
          widthIndex: 1,
          headerContent: (
            <div className="flex h-full items-center overflow-hidden py-1">
              <TimelineController
                durationSeconds={durationSeconds}
                timelineData={controls.timelineData}
                onZoomChange={controls.onZoomChange}
                isDark={isDark}
              />
            </div>
          ),
          subHeaderContent: <TimelineRuler isDark={isDark} />,
          render: ({ item }: { item: TimelineTreeItem }) =>
            modelsByItemId.get(item.id)?.renderTimeline(item) ?? null,
        },
      ] satisfies Column<TimelineTreeItem>[],
    [
      controls.onZoomChange,
      controls.timelineData,
      durationSeconds,
      isAtPinLimit,
      isDark,
      modelsByItemId,
      onTogglePin,
      pinnedIds,
      workerLabels,
    ]
  );

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      {slots ? (
        <>
          {slots.leftSlot && controls.filters && createPortal(controls.filters, slots.leftSlot)}
          {slots.rightSlot &&
            createPortal(<TimelineActions durationSeconds={durationSeconds} />, slots.rightSlot)}
        </>
      ) : (
        <TimelineToolbar durationSeconds={durationSeconds} filters={controls.filters} />
      )}
      <div className="min-h-0 min-w-0 flex-1">
        {data.length > 0 ? (
          <TreeTable<TimelineTreeItem>
            data={data}
            columns={columns}
            initialSelectedItemId={controls.initialSelectedItemId}
            columnWidths={[275, 'auto']}
            onExpandChange={controls.onExpandChange}
            pinnedItems={controls.pinnedItems}
            hiddenPinnedCount={controls.hiddenPinnedCount}
            isPinnedCollapsed={controls.isPinnedCollapsed}
            onTogglePinnedCollapsed={controls.onTogglePinnedCollapsed}
            revealItem={controls.revealItem}
            onRevealPinned={controls.onRevealPinned}
            highlightedItemIds={controls.highlightedItemIds}
            indicatorItemIds={controls.indicatorItemIds}
            controlledExpandedIds={controls.expandedIds}
            virtualized
            rowHeight={DEFAULT_TIMELINE_HEIGHT}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted-foreground">
            {controls.emptyMessage ?? 'No timeline data available.'}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
