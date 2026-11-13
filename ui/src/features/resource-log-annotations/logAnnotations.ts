// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ZoomRange } from '@quent/utils';

export type ResourceLogSeverity = 'info' | 'warning' | 'error';

export interface ResourceLogEntry {
  id: string;
  resourceId: string;
  timestampSeconds: number;
  severity: ResourceLogSeverity;
  source: string;
  message: string;
}

export interface ResourceLogCluster {
  id: string;
  resourceId: string;
  anchorSeconds: number;
  severity: ResourceLogSeverity;
  logs: readonly ResourceLogEntry[];
}

interface GenerateMockResourceLogsOptions {
  queryId: string;
  resourceId: string;
  durationSeconds: number;
}

interface ClusterVisibleLogsOptions {
  logs: readonly ResourceLogEntry[];
  zoomRange: ZoomRange;
  widthPx: number;
  minGapPx?: number;
}

const SEVERITY_PRIORITY: Record<ResourceLogSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
};

const LOG_TEMPLATES: ReadonlyArray<Pick<ResourceLogEntry, 'severity' | 'source' | 'message'>> = [
  {
    severity: 'info',
    source: 'scheduler',
    message: 'Work batch dispatched to the resource.',
  },
  {
    severity: 'info',
    source: 'runtime',
    message: 'Resource state checkpoint recorded.',
  },
  {
    severity: 'warning',
    source: 'runtime',
    message: 'Operation latency exceeded the expected range.',
  },
  {
    severity: 'warning',
    source: 'scheduler',
    message: 'Queue depth is approaching the configured limit.',
  },
  {
    severity: 'error',
    source: 'runtime',
    message: 'Operation failed and will be retried.',
  },
];

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateMockResourceLogs({
  queryId,
  resourceId,
  durationSeconds,
}: GenerateMockResourceLogsOptions): readonly ResourceLogEntry[] {
  if (durationSeconds <= 0) {
    return [];
  }

  const random = createRandom(hashString(`${queryId}:${resourceId}`));
  const count = 8 + Math.floor(random() * 7);
  const burstCenter = durationSeconds * (0.35 + random() * 0.3);
  const burstRadius = Math.max(durationSeconds * 0.003, 0.001);

  return Array.from({ length: count }, (_, index) => {
    const template = LOG_TEMPLATES[Math.floor(random() * LOG_TEMPLATES.length)]!;
    const isBurst = index < Math.min(5, count);
    const timestampSeconds = isBurst
      ? burstCenter + (random() * 2 - 1) * burstRadius
      : random() * durationSeconds;

    return {
      id: `${resourceId}:mock-log:${index}`,
      resourceId,
      timestampSeconds: Math.min(durationSeconds, Math.max(0, timestampSeconds)),
      ...template,
    };
  }).sort((left, right) => left.timestampSeconds - right.timestampSeconds);
}

export function projectTimestampToPercent(timestampSeconds: number, zoomRange: ZoomRange): number {
  return ((timestampSeconds - zoomRange.start) / (zoomRange.end - zoomRange.start)) * 100;
}

export function clusterVisibleLogs({
  logs,
  zoomRange,
  widthPx,
  minGapPx = 16,
}: ClusterVisibleLogsOptions): readonly ResourceLogCluster[] {
  const spanSeconds = zoomRange.end - zoomRange.start;
  if (widthPx <= 0 || spanSeconds <= 0) {
    return [];
  }

  const visible = logs.filter(
    log => log.timestampSeconds >= zoomRange.start && log.timestampSeconds <= zoomRange.end
  );
  const groups: ResourceLogEntry[][] = [];

  for (const log of visible) {
    const previousGroup = groups[groups.length - 1];
    const previousAnchor = previousGroup
      ? previousGroup.reduce((total, entry) => total + entry.timestampSeconds, 0) /
        previousGroup.length
      : null;
    const distancePx =
      previousAnchor == null
        ? Number.POSITIVE_INFINITY
        : ((log.timestampSeconds - previousAnchor) / spanSeconds) * widthPx;
    if (previousGroup && distancePx < minGapPx) {
      previousGroup.push(log);
    } else {
      groups.push([log]);
    }
  }

  return groups.map(group => {
    const severity = group.reduce<ResourceLogSeverity>(
      (highest, log) =>
        SEVERITY_PRIORITY[log.severity] > SEVERITY_PRIORITY[highest] ? log.severity : highest,
      'info'
    );
    const anchorSeconds =
      group.reduce((total, log) => total + log.timestampSeconds, 0) / group.length;
    return {
      id: group.map(log => log.id).join('|'),
      resourceId: group[0]!.resourceId,
      anchorSeconds,
      severity,
      logs: group,
    };
  });
}
