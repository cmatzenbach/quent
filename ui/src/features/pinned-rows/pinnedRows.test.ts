// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { buildPinnedWorkerLabels, reorderPinnedIds, resolvePinnedRows } from './pinnedRows';

interface Node {
  id: string;
  children?: Node[];
}

const leaf = (id: string): Node => ({ id });
const group = (id: string, ...children: Node[]): Node => ({ id, children });

// root
//  ├─ worker-1
//  │   ├─ gpu-0
//  │   └─ gpu-1
//  └─ worker-2
//      └─ gpu-2
const fullTree = (): Node[] => [
  group('root', group('worker-1', leaf('gpu-0'), leaf('gpu-1')), group('worker-2', leaf('gpu-2'))),
];

const ids = (nodes: Node[]) => nodes.map(node => node.id);

describe('resolvePinnedRows', () => {
  it('returns nothing when no rows are pinned', () => {
    const result = resolvePinnedRows(new Set(), fullTree(), fullTree());

    expect(result.shownItems).toEqual([]);
    expect(result.hiddenCount).toBe(0);
  });

  it('shows every pinned row when nothing is filtered out', () => {
    const result = resolvePinnedRows(new Set(['gpu-1', 'worker-2']), fullTree(), fullTree());

    expect(ids(result.shownItems)).toEqual(['gpu-1', 'worker-2']);
    expect(result.hiddenCount).toBe(0);
  });

  it('orders shown rows by pin order, not by position in the tree', () => {
    const result = resolvePinnedRows(
      new Set(['gpu-2', 'gpu-0', 'worker-1']),
      fullTree(),
      fullTree()
    );

    expect(ids(result.shownItems)).toEqual(['gpu-2', 'gpu-0', 'worker-1']);
  });

  it('finds pinned rows regardless of which ancestors are expanded', () => {
    // The helper only sees structure, so deeply nested rows are found directly.
    const result = resolvePinnedRows(new Set(['gpu-2']), fullTree(), fullTree());

    expect(ids(result.shownItems)).toEqual(['gpu-2']);
  });

  it('hides pinned rows that a filter removed from the displayed tree and counts them', () => {
    const displayed = [group('root', group('worker-1', leaf('gpu-0')))];

    const result = resolvePinnedRows(new Set(['gpu-0', 'gpu-1', 'gpu-2']), fullTree(), displayed);

    expect(ids(result.shownItems)).toEqual(['gpu-0']);
    expect(result.hiddenCount).toBe(2);
  });

  it('brings hidden pins back when the displayed tree is unfiltered again', () => {
    const pinned = new Set(['gpu-0', 'gpu-2']);
    const displayed = [group('root', group('worker-1', leaf('gpu-0')))];

    expect(resolvePinnedRows(pinned, fullTree(), displayed).hiddenCount).toBe(1);

    const restored = resolvePinnedRows(pinned, fullTree(), fullTree());
    expect(ids(restored.shownItems)).toEqual(['gpu-0', 'gpu-2']);
    expect(restored.hiddenCount).toBe(0);
  });

  it('ignores pinned ids that do not exist anywhere and does not count them as hidden', () => {
    const result = resolvePinnedRows(new Set(['gpu-0', 'unknown']), fullTree(), fullTree());

    expect(ids(result.shownItems)).toEqual(['gpu-0']);
    expect(result.hiddenCount).toBe(0);
  });

  it('returns the displayed tree items so callers render what the tree renders', () => {
    const displayed = fullTree();

    const result = resolvePinnedRows(new Set(['gpu-1']), fullTree(), displayed);

    expect(result.shownItems[0]).toBe(displayed[0]!.children![0]!.children![1]);
  });

  it('does not modify its inputs', () => {
    const pinned = new Set(['gpu-0']);
    const full = fullTree();
    const displayed = fullTree();
    const fullSnapshot = JSON.stringify(full);
    const displayedSnapshot = JSON.stringify(displayed);

    resolvePinnedRows(pinned, full, displayed);

    expect([...pinned]).toEqual(['gpu-0']);
    expect(JSON.stringify(full)).toBe(fullSnapshot);
    expect(JSON.stringify(displayed)).toBe(displayedSnapshot);
  });
});

describe('buildPinnedWorkerLabels', () => {
  interface WorkerNode {
    id: string;
    worker?: string;
    parent?: string;
    children?: WorkerNode[];
  }

  // engine
  //  ├─ worker-0 (a worker)
  //  │   ├─ gpu-0
  //  │   │   └─ (Entities lane for gpu-0, a sibling of gpu-0)
  //  │   └─ (Operators lane, a child of worker-0)
  //  └─ network (no worker above it)
  //      └─ channel
  const tree = (): WorkerNode[] => [
    {
      id: 'engine',
      children: [
        {
          id: 'worker-0',
          worker: 'worker-0',
          children: [
            { id: 'ops:worker-0', parent: 'worker-0' },
            { id: 'gpu-0' },
            { id: 'ent:gpu-0', parent: 'gpu-0' },
          ],
        },
        { id: 'network', children: [{ id: 'channel' }] },
      ],
    },
  ];
  const labels = (roots = tree()) =>
    buildPinnedWorkerLabels(
      roots,
      row => row.worker,
      row => row.parent
    );

  it('names the worker a row sits under', () => {
    expect(labels().get('gpu-0')).toBe('worker-0');
  });

  it('gives a worker row no label of its own', () => {
    expect(labels().has('worker-0')).toBe(false);
  });

  it('gives rows with no worker above them no label', () => {
    const result = labels();

    expect(result.has('engine')).toBe(false);
    expect(result.has('network')).toBe(false);
    expect(result.has('channel')).toBe(false);
  });

  it('names the worker of the resource an Entities lane belongs to', () => {
    expect(labels().get('ent:gpu-0')).toBe('worker-0');
  });

  it('names the worker an Operators lane belongs to', () => {
    expect(labels().get('ops:worker-0')).toBe('worker-0');
  });

  it('uses the nearest worker when workers are nested', () => {
    const roots: WorkerNode[] = [
      {
        id: 'outer',
        worker: 'outer',
        children: [{ id: 'inner', worker: 'inner', children: [{ id: 'leaf' }] }],
      },
    ];

    expect(labels(roots).get('leaf')).toBe('inner');
    expect(labels(roots).get('inner')).toBe('outer');
  });

  it('falls back to the tree when the named parent is not in the tree', () => {
    const roots = tree();
    roots[0]!.children![0]!.children![2]!.parent = 'missing';

    expect(labels(roots).get('ent:gpu-0')).toBe('worker-0');
  });
});

describe('reorderPinnedIds', () => {
  it('moves a pin down to the position of the row it was dropped on', () => {
    const result = reorderPinnedIds(new Set(['a', 'b', 'c', 'd']), 'a', 'c');

    expect([...result]).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a pin up to the position of the row it was dropped on', () => {
    const result = reorderPinnedIds(new Set(['a', 'b', 'c', 'd']), 'd', 'b');

    expect([...result]).toEqual(['a', 'd', 'b', 'c']);
  });

  it('keeps pins that a filter hides in their place relative to each other', () => {
    // 'x' is hidden by a filter, so the user only sees a, b, c.
    const result = reorderPinnedIds(new Set(['a', 'x', 'b', 'c']), 'c', 'a');

    expect([...result]).toEqual(['c', 'a', 'x', 'b']);
  });

  it('returns the same set when the row is dropped on itself', () => {
    const pins = new Set(['a', 'b']);

    expect(reorderPinnedIds(pins, 'a', 'a')).toBe(pins);
  });

  it('returns the same set when either id is not pinned', () => {
    const pins = new Set(['a', 'b']);

    expect(reorderPinnedIds(pins, 'a', 'zzz')).toBe(pins);
    expect(reorderPinnedIds(pins, 'zzz', 'a')).toBe(pins);
  });

  it('does not modify the set it was given', () => {
    const pins = new Set(['a', 'b', 'c']);

    reorderPinnedIds(pins, 'a', 'c');

    expect([...pins]).toEqual(['a', 'b', 'c']);
  });
});
