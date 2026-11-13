// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useSetDataFlowIsPlaying,
  useSetPlayheadLineTimeMs,
  useSetPlayheadTimeS,
  useZoomRange,
} from '@quent/hooks';
import { TIMELINE_SPACING } from '@quent/components';
import { cn } from '@quent/utils';
import {
  clusterVisibleLogs,
  type ResourceLogCluster,
  type ResourceLogEntry,
  type ResourceLogSeverity,
} from './logAnnotations';

interface ResourceLogMarkersProps {
  resourceId: string;
  logs: readonly ResourceLogEntry[];
  onSelect: (logIds: readonly string[]) => void;
}

const MARKER_MIN_GAP_PX = 16;
const EMPTY_LOG_IDS: readonly string[] = [];

interface ResourceLogSelectionContextValue {
  resourceId: string;
  logIds: readonly string[];
}

const ResourceLogSelectionContext = createContext<ResourceLogSelectionContextValue | null>(null);

export function ResourceLogSelectionProvider({
  resourceId,
  logIds,
  children,
}: {
  resourceId: string | null;
  logIds: readonly string[];
  children: ReactNode;
}) {
  const value = useMemo(
    () => (resourceId === null ? null : { resourceId, logIds }),
    [logIds, resourceId]
  );
  return (
    <ResourceLogSelectionContext.Provider value={value}>
      {children}
    </ResourceLogSelectionContext.Provider>
  );
}

const severityClasses: Record<ResourceLogSeverity, string> = {
  info: 'fill-sky-500',
  warning: 'fill-amber-500 dark:fill-amber-400',
  error: 'fill-destructive',
};

const clusterClasses: Record<ResourceLogSeverity, string> = {
  info: 'bg-sky-500 text-white',
  warning: 'bg-amber-500 text-black dark:bg-amber-400',
  error: 'bg-destructive text-destructive-foreground',
};

function FlyingVMarker({
  severity,
  isSelected,
}: {
  severity: ResourceLogSeverity;
  isSelected: boolean;
}) {
  return (
    <svg
      aria-hidden
      className={cn('size-4 drop-shadow-sm', severityClasses[severity])}
      viewBox="0 0 16 16"
    >
      <polygon
        points="1.5,1.5 8,14.5 14.5,1.5 8,6"
        stroke="currentColor"
        strokeWidth={isSelected ? 1.8 : 0.8}
        strokeLinejoin="round"
        className={isSelected ? 'text-foreground' : 'text-background'}
      />
    </svg>
  );
}

function markerLabel(cluster: ResourceLogCluster): string {
  if (cluster.logs.length > 1) {
    return `${cluster.logs.length} logs at ${cluster.anchorSeconds.toFixed(3)} seconds; highest severity ${cluster.severity}`;
  }
  const log = cluster.logs[0]!;
  return `${log.severity} log at ${log.timestampSeconds.toFixed(3)} seconds: ${log.message}`;
}

export function ResourceLogMarkers({ resourceId, logs, onSelect }: ResourceLogMarkersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widthPx, setWidthPx] = useState(0);
  const zoomRange = useZoomRange();
  const setIsPlaying = useSetDataFlowIsPlaying();
  const setPlayheadLineTimeMs = useSetPlayheadLineTimeMs();
  const setPlayheadTimeS = useSetPlayheadTimeS();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const updateWidth = () => setWidthPx(container.getBoundingClientRect().width);
    updateWidth();
    const observer = new ResizeObserver(entries => {
      setWidthPx(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const plotWidthPx = Math.max(0, widthPx - TIMELINE_SPACING.left - TIMELINE_SPACING.right);
  const clusters = useMemo(
    () =>
      clusterVisibleLogs({
        logs,
        zoomRange,
        widthPx: plotWidthPx,
        minGapPx: MARKER_MIN_GAP_PX,
      }),
    [logs, plotWidthPx, zoomRange]
  );
  const selection = useContext(ResourceLogSelectionContext);
  const activeLogIds = selection?.resourceId === resourceId ? selection.logIds : EMPTY_LOG_IDS;
  const selectedIds = useMemo(() => new Set(activeLogIds), [activeLogIds]);
  const spanSeconds = zoomRange.end - zoomRange.start;

  return (
    <div
      ref={containerRef}
      data-testid="resource-log-marker-overlay"
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
    >
      {clusters.map(cluster => {
        const leftPx =
          TIMELINE_SPACING.left +
          ((cluster.anchorSeconds - zoomRange.start) / spanSeconds) * plotWidthPx;
        const logIds = cluster.logs.map(log => log.id);
        const hasSelection = logIds.some(id => selectedIds.has(id));
        const isSelected = logIds.every(id => selectedIds.has(id));
        const isCluster = cluster.logs.length > 1;
        return (
          <button
            key={cluster.id}
            type="button"
            data-log-marker
            data-marker-shape={isCluster ? 'cluster' : 'flying-v'}
            aria-label={markerLabel(cluster)}
            title={markerLabel(cluster)}
            className={cn(
              'pointer-events-auto absolute top-0 flex h-5 -translate-x-1/2 items-start justify-center border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isCluster
                ? cn(
                    'min-w-5 rounded-full px-1 text-[10px] font-bold leading-5',
                    clusterClasses[cluster.severity],
                    isSelected
                      ? 'ring-2 ring-foreground'
                      : hasSelection && 'ring-1 ring-foreground/60'
                  )
                : 'w-6 bg-transparent'
            )}
            style={{ left: leftPx }}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => {
              event.stopPropagation();
              onSelect(logIds);
              setIsPlaying(false);
              setPlayheadTimeS(cluster.anchorSeconds);
              setPlayheadLineTimeMs(cluster.anchorSeconds * 1000);
            }}
          >
            {isCluster ? (
              cluster.logs.length
            ) : (
              <FlyingVMarker severity={cluster.severity} isSelected={hasSelection} />
            )}
          </button>
        );
      })}
    </div>
  );
}
