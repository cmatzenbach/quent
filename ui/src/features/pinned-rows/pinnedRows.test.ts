// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { resolvePinnedRows } from './pinnedRows';

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
