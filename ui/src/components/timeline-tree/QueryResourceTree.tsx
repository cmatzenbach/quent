// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState } from 'react';
import type { EntityRef, FiniteStateMachine, QueryBundle, ZoomRange } from '@quent/utils';
import { EntityDetailDrawer } from '@/components/EntityDetailDrawer';
import { ResourceLogInspector } from '@/features/resource-log-annotations/ResourceLogInspector';
import {
  ResourceLogMarkers,
  ResourceLogSelectionProvider,
} from '@/features/resource-log-annotations/ResourceLogMarkers';
import {
  generateMockResourceLogs,
  type ResourceLogEntry,
} from '@/features/resource-log-annotations/logAnnotations';
import { useNvtxTreeModel } from './NvtxTree';
import { createLongEntitiesTimelineSubRow, createOperatorGanttTimelineSubRow } from './sub-rows';
import {
  useResourceTimelinesTreeModel,
  type ResourceTimelineSubRow,
  type SiblingPinning,
} from './ResourceTimelinesTree';
import { TimelineTreeTable, useTimelineTreeSetup } from './TimelineTreeTable';
import { useFullDurationZeroUtilizationResourceIds } from './useFullDurationZeroUtilizationResourceIds';
import type { TimelineTreeItem } from './TimelineTreeTable';

interface ResourceLogSelection {
  resourceId: string;
  logs: readonly ResourceLogEntry[];
}

export interface QueryResourceTreeProps {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
  resourceSubRows?: readonly ResourceTimelineSubRow[];
  initialZoomRange?: ZoomRange;
  seedRootExpanded?: boolean;
}

export function QueryResourceTree({
  queryBundle,
  engineId,
  resourceSubRows,
  initialZoomRange,
  seedRootExpanded = true,
}: QueryResourceTreeProps) {
  const { durationSeconds, isDark } = useTimelineTreeSetup(queryBundle, initialZoomRange);
  const { entities } = queryBundle;

  const [drawerFsm, setDrawerFsm] = useState<FiniteStateMachine | null>(null);
  const [logSelection, setLogSelection] = useState<ResourceLogSelection | null>(null);
  const toggleDrawerFsm = useCallback((fsm: FiniteStateMachine) => {
    setLogSelection(null);
    setDrawerFsm(selectedFsm => (selectedFsm?.id === fsm.id ? null : fsm));
  }, []);
  const closeDrawer = useCallback(() => setDrawerFsm(null), []);
  const closeLogInspector = useCallback(() => setLogSelection(null), []);

  const resourceLabel = useCallback(
    (id: string) => {
      const resource = entities.resources[id];
      return resource ? `${resource.instance_name} (${resource.type_name})` : id;
    },
    [entities.resources]
  );
  const operatorLabel = useCallback(
    (id: string) => {
      const operator = entities.operators[id];
      return operator ? (operator.instance_name ?? operator.operator_type_name ?? id) : id;
    },
    [entities.operators]
  );

  const operatorGanttSubRow = useMemo(
    () => createOperatorGanttTimelineSubRow({ queryBundle, isDark }),
    [isDark, queryBundle]
  );
  const zeroUtilizationResourceIds = useFullDurationZeroUtilizationResourceIds(
    engineId,
    queryBundle.query_id,
    queryBundle.duration_s,
    entities,
    resourceSubRows === undefined
  );
  const longEntitiesSubRow = useMemo(
    () =>
      createLongEntitiesTimelineSubRow({
        engineId,
        queryBundle,
        isDark,
        onEntitySelect: toggleDrawerFsm,
        selectedEntityId: drawerFsm?.id,
        onBackgroundClick: closeDrawer,
        zeroUtilizationResourceIds,
      }),
    [
      closeDrawer,
      drawerFsm?.id,
      engineId,
      isDark,
      queryBundle,
      toggleDrawerFsm,
      zeroUtilizationResourceIds,
    ]
  );
  const defaultResourceSubRows = useMemo(
    () => [operatorGanttSubRow, longEntitiesSubRow],
    [longEntitiesSubRow, operatorGanttSubRow]
  );
  const nvtxTree = useNvtxTreeModel({ engineId, queryBundle, isDark });
  // NVTX rows share the resource tree's pinned section and "pin all" button.
  const nvtxPinning = useMemo<SiblingPinning>(
    () => ({
      fullRoots: nvtxTree.fullTree ? [nvtxTree.fullTree] : [],
      displayedRoots: nvtxTree.trees,
      matchIds: nvtxTree.pinnableMatchIds,
    }),
    [nvtxTree.fullTree, nvtxTree.pinnableMatchIds, nvtxTree.trees]
  );
  const logsByResourceId = useMemo(
    () =>
      new Map(
        Object.keys(entities.resources).map(
          resourceId =>
            [
              resourceId,
              generateMockResourceLogs({
                queryId: queryBundle.query_id,
                resourceId,
                durationSeconds: queryBundle.duration_s,
              }),
            ] as const
        )
      ),
    [entities.resources, queryBundle.duration_s, queryBundle.query_id]
  );
  const renderTimelineOverlay = useCallback(
    (item: TimelineTreeItem) => {
      const logs = logsByResourceId.get(item.id);
      if (!logs) {
        return null;
      }
      return (
        <ResourceLogMarkers
          resourceId={item.id}
          logs={logs}
          onSelect={logIds => {
            const selectedIds = new Set(logIds);
            setDrawerFsm(null);
            setLogSelection({
              resourceId: item.id,
              logs: logs.filter(log => selectedIds.has(log.id)),
            });
          }}
        />
      );
    },
    [logsByResourceId]
  );
  const resourceTree = useResourceTimelinesTreeModel({
    engineId,
    queryBundle,
    isDark,
    subRows: resourceSubRows ?? defaultResourceSubRows,
    seedRootExpanded,
    siblingPinning: nvtxPinning,
    renderTimelineOverlay,
  });
  const highlightedItemIds = new Set([
    ...(resourceTree.highlightedItemIds ?? []),
    ...(nvtxTree.highlightedItemIds ?? []),
  ]);
  const indicatorItemIds = new Set([
    ...(resourceTree.indicatorItemIds ?? []),
    ...(nvtxTree.indicatorItemIds ?? []),
  ]);
  const hasFilterMatches = resourceTree.filterMatchCount + nvtxTree.filterMatchCount > 0;
  const trees =
    resourceTree.isFilterActive && resourceTree.showOthers && !hasFilterMatches
      ? []
      : [resourceTree, nvtxTree];
  const selectedLogIds = useMemo(() => logSelection?.logs.map(log => log.id) ?? [], [logSelection]);

  return (
    <ResourceLogSelectionProvider
      resourceId={logSelection?.resourceId ?? null}
      logIds={selectedLogIds}
    >
      <TimelineTreeTable
        durationSeconds={durationSeconds}
        isDark={isDark}
        trees={trees}
        controls={{ ...resourceTree, highlightedItemIds, indicatorItemIds }}
      >
        <EntityDetailDrawer
          fsm={drawerFsm}
          resourceLabel={resourceLabel}
          operatorLabel={operatorLabel}
          onClose={closeDrawer}
          queryBundle={queryBundle}
        />
        <ResourceLogInspector
          logs={logSelection?.logs ?? null}
          resourceLabel={logSelection ? resourceLabel(logSelection.resourceId) : ''}
          onClose={closeLogInspector}
        />
      </TimelineTreeTable>
    </ResourceLogSelectionProvider>
  );
}
