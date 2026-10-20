// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { buildPinnedPathLabels, resolvePinnedRows } from './pinnedRows';

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

  it('orders shown rows by position in the tree, not by pin order', () => {
    const result = resolvePinnedRows(
      new Set(['gpu-2', 'gpu-0', 'worker-1']),
      fullTree(),
      fullTree()
    );

    expect(ids(result.shownItems)).toEqual(['worker-1', 'gpu-0', 'gpu-2']);
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

describe('buildPinnedPathLabels', () => {
  interface NamedNode {
    id: string;
    name?: string;
    parent?: string;
    children?: NamedNode[];
  }

  // Cluster
  //  └─ Worker 1
  //      ├─ GPU 0
  //      ├─ (Entities lane for GPU 0, a sibling of GPU 0)
  //      └─ (Operators lane, a child of Worker 1)
  const tree = (): NamedNode[] => [
    {
      id: 'cluster',
      name: 'Cluster',
      children: [
        {
          id: 'worker-1',
          name: 'Worker 1',
          children: [
            { id: 'ops:worker-1', parent: 'worker-1' },
            { id: 'gpu-0', name: 'GPU 0' },
            { id: 'ent:gpu-0', parent: 'gpu-0' },
          ],
        },
      ],
    },
  ];
  const labels = (roots = tree()) =>
    buildPinnedPathLabels(
      roots,
      row => row.name,
      row => row.parent
    );

  it('labels a row with the names of its ancestors', () => {
    const result = labels();

    expect(result.get('gpu-0')).toBe('Cluster › Worker 1');
    expect(result.get('worker-1')).toBe('Cluster');
  });

  it('gives top-level rows an empty path', () => {
    expect(labels().get('cluster')).toBe('');
  });

  it('labels a lane that belongs to a resource with that resource included', () => {
    expect(labels().get('ent:gpu-0')).toBe('Cluster › Worker 1 › GPU 0');
  });

  it('labels a lane that is a child of a group with that group included', () => {
    expect(labels().get('ops:worker-1')).toBe('Cluster › Worker 1');
  });

  it('falls back to the tree ancestors when the named parent is not in the tree', () => {
    const roots = tree();
    roots[0]!.children![0]!.children![2]!.parent = 'missing';

    expect(labels(roots).get('ent:gpu-0')).toBe('Cluster › Worker 1');
  });

  it('skips ancestors that have no name', () => {
    const roots: NamedNode[] = [
      { id: 'a', children: [{ id: 'b', name: 'B', children: [{ id: 'c', name: 'C' }] }] },
    ];

    expect(labels(roots).get('c')).toBe('B');
  });
});
