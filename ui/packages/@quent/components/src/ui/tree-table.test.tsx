// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TreeTable, type Column } from './tree-table';

interface Row {
  id: string;
  name: string;
  children?: Row[];
}

const ROW_HEIGHT = 40;
const row = (id: string): Row => ({ id, name: `Row ${id}` });

const renderCalls: { id: string; isPinned: boolean | undefined }[] = [];
const columns: Column<Row>[] = [
  {
    key: 'name',
    label: 'Name',
    widthIndex: 0,
    isFirst: true,
    render: ({ item, isPinned }) => {
      renderCalls.push({ id: item.id, isPinned });
      return <span>{item.name}</span>;
    },
  },
];

interface PinnedProps {
  pinnedItems?: Row[];
  hiddenPinnedCount?: number;
  isPinnedCollapsed?: boolean;
  onTogglePinnedCollapsed?: () => void;
}

function renderTable(pinned: PinnedProps = {}) {
  return render(
    <TreeTable<Row>
      data={[row('a'), row('b')]}
      columns={columns}
      virtualized
      rowHeight={ROW_HEIGHT}
      {...pinned}
    />
  );
}

describe('TreeTable pinned section', () => {
  it('renders nothing extra when no rows are pinned', () => {
    renderTable();

    expect(screen.queryByRole('region', { name: 'Pinned rows' })).not.toBeInTheDocument();
  });

  it('renders each pinned row through the columns with isPinned set', () => {
    renderCalls.length = 0;
    renderTable({ pinnedItems: [row('x'), row('y')] });

    const region = screen.getByRole('region', { name: 'Pinned rows' });
    expect(within(region).getByText('Row x')).toBeInTheDocument();
    expect(within(region).getByText('Row y')).toBeInTheDocument();
    // The table re-renders while it measures itself, so compare the distinct rows drawn as pinned.
    const pinnedIds = new Set(renderCalls.filter(call => call.isPinned).map(call => call.id));
    expect([...pinnedIds]).toEqual(['x', 'y']);
    expect(renderCalls.some(call => call.id === 'a' && call.isPinned)).toBe(false);
  });

  it('shows how many rows are pinned in the header', () => {
    renderTable({ pinnedItems: [row('x'), row('y'), row('z')] });

    expect(screen.getByRole('button', { name: /Pinned \(3\)/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('hides the rows but keeps the header when collapsed', () => {
    renderTable({ pinnedItems: [row('x')], isPinnedCollapsed: true });

    expect(screen.getByRole('button', { name: /Pinned \(1\)/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByText('Row x')).not.toBeInTheDocument();
  });

  it('asks to toggle collapsing when the header is clicked', async () => {
    const onTogglePinnedCollapsed = vi.fn();
    renderTable({ pinnedItems: [row('x')], onTogglePinnedCollapsed });

    await userEvent.click(screen.getByRole('button', { name: /Pinned \(1\)/ }));

    expect(onTogglePinnedCollapsed).toHaveBeenCalledTimes(1);
  });

  it('explains pins that a filter has hidden', () => {
    renderTable({ pinnedItems: [row('x')], hiddenPinnedCount: 2 });

    expect(screen.getByText('2 hidden by filter')).toBeInTheDocument();
  });

  it('keeps the header when every pin is hidden by a filter', () => {
    renderTable({ pinnedItems: [], hiddenPinnedCount: 2 });

    expect(screen.getByRole('button', { name: /Pinned \(0\)/ })).toBeInTheDocument();
    expect(screen.getByText('2 hidden by filter')).toBeInTheDocument();
  });

  it('limits the visible height to six rows and scrolls beyond that', () => {
    const pinnedItems = Array.from({ length: 8 }, (_, i) => row(`p${i}`));
    renderTable({ pinnedItems });

    const list = screen.getByRole('list', { name: 'Pinned rows list' });
    expect(list.style.maxHeight).toBe(`${6 * ROW_HEIGHT}px`);
    expect(list).toHaveClass('overflow-y-auto');
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
  });

  it('sits inside the sticky header so it stays put while the tree scrolls', () => {
    renderTable({ pinnedItems: [row('x')] });

    const region = screen.getByRole('region', { name: 'Pinned rows' });
    expect(region.closest<HTMLElement>('[style*="sticky"]')).not.toBeNull();
  });
});
