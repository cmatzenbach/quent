// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  clusterVisibleLogs,
  generateMockResourceLogs,
  projectTimestampToPercent,
  type ResourceLogEntry,
} from './logAnnotations';

const makeLog = (
  id: string,
  timestampSeconds: number,
  severity: ResourceLogEntry['severity'] = 'info'
): ResourceLogEntry => ({
  id,
  resourceId: 'resource-1',
  timestampSeconds,
  severity,
  source: 'test',
  message: `Log ${id}`,
});

describe('generateMockResourceLogs', () => {
  it('generates stable, sorted logs owned by the requested resource', () => {
    const input = { queryId: 'query-1', resourceId: 'gpu-0', durationSeconds: 100 };

    const first = generateMockResourceLogs(input);
    const second = generateMockResourceLogs(input);

    expect(second).toEqual(first);
    expect(first.length).toBeGreaterThan(3);
    expect(first.every(log => log.resourceId === input.resourceId)).toBe(true);
    expect(first.map(log => log.timestampSeconds)).toEqual(
      [...first.map(log => log.timestampSeconds)].sort((a, b) => a - b)
    );
    expect(new Set(first.map(log => log.id)).size).toBe(first.length);
    expect(first.every(log => log.timestampSeconds >= 0 && log.timestampSeconds <= 100)).toBe(true);
  });

  it('varies logs by resource and returns no logs for an empty duration', () => {
    const first = generateMockResourceLogs({
      queryId: 'query-1',
      resourceId: 'gpu-0',
      durationSeconds: 100,
    });
    const second = generateMockResourceLogs({
      queryId: 'query-1',
      resourceId: 'gpu-1',
      durationSeconds: 100,
    });

    expect(second).not.toEqual(first);
    expect(
      generateMockResourceLogs({
        queryId: 'query-1',
        resourceId: 'gpu-0',
        durationSeconds: 0,
      })
    ).toEqual([]);
  });
});

describe('clusterVisibleLogs', () => {
  it('filters to the viewport and clusters nearby projected timestamps', () => {
    const clusters = clusterVisibleLogs({
      logs: [
        makeLog('outside-before', 4),
        makeLog('one', 10, 'info'),
        makeLog('two', 10.5, 'error'),
        makeLog('three', 18, 'warning'),
        makeLog('outside-after', 21),
      ],
      zoomRange: { start: 5, end: 20 },
      widthPx: 300,
      minGapPx: 16,
    });

    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.logs.map(log => log.id)).toEqual(['one', 'two']);
    expect(clusters[0]?.severity).toBe('error');
    expect(clusters[0]?.anchorSeconds).toBe(10.25);
    expect(clusters[1]?.logs.map(log => log.id)).toEqual(['three']);
  });

  it('splits a cluster after zooming in', () => {
    const logs = [makeLog('one', 10), makeLog('two', 10.5)];

    expect(
      clusterVisibleLogs({
        logs,
        zoomRange: { start: 0, end: 100 },
        widthPx: 300,
        minGapPx: 16,
      })
    ).toHaveLength(1);
    expect(
      clusterVisibleLogs({
        logs,
        zoomRange: { start: 9, end: 12 },
        widthPx: 300,
        minGapPx: 16,
      })
    ).toHaveLength(2);
  });

  it('returns no clusters without plot width or viewport span', () => {
    const logs = [makeLog('one', 10)];

    expect(
      clusterVisibleLogs({
        logs,
        zoomRange: { start: 0, end: 100 },
        widthPx: 0,
      })
    ).toEqual([]);
    expect(
      clusterVisibleLogs({
        logs,
        zoomRange: { start: 10, end: 10 },
        widthPx: 300,
      })
    ).toEqual([]);
  });
});

describe('projectTimestampToPercent', () => {
  it('maps timestamps to their horizontal viewport position', () => {
    expect(projectTimestampToPercent(10, { start: 10, end: 30 })).toBe(0);
    expect(projectTimestampToPercent(20, { start: 10, end: 30 })).toBe(50);
    expect(projectTimestampToPercent(30, { start: 10, end: 30 })).toBe(100);
  });
});
