// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  onRevealPinned?: (id: string) => void;
  pinnedItems?: Row[];
  hiddenPinnedCount?: number;
  isPinnedCollapsed?: boolean;
  onTogglePinnedCollapsed?: () => void;
}

function renderTable(pinned: PinnedProps = {}, tableColumns: Column<Row>[] = columns) {
  return render(
    <TreeTable<Row>
      data={[row('a'), row('b')]}
      columns={tableColumns}
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

describe('TreeTable pinned row clicks', () => {
  const controlColumns: Column<Row>[] = [
    {
      key: 'name',
      label: 'Name',
      widthIndex: 0,
      isFirst: true,
      render: ({ item }) => (
        <>
          <span>{item.name}</span>
          <button type="button">Pin {item.name}</button>
          <div role="combobox" aria-expanded="false" aria-label={`Type for ${item.name}`}>
            GPU
          </div>
        </>
      ),
    },
  ];

  it('asks to reveal the row when the pinned row is clicked', async () => {
    const onRevealPinned = vi.fn();
    renderTable({ pinnedItems: [row('x')], onRevealPinned });

    await userEvent.click(screen.getByText('Row x'));

    expect(onRevealPinned).toHaveBeenCalledWith('x');
  });

  it('does not reveal the row when a button inside it is clicked', async () => {
    const onRevealPinned = vi.fn();
    renderTable({ pinnedItems: [row('x')], onRevealPinned }, controlColumns);

    await userEvent.click(screen.getByRole('button', { name: 'Pin Row x' }));

    expect(onRevealPinned).not.toHaveBeenCalled();
  });

  it('does not reveal the row when a dropdown inside it is clicked', async () => {
    const onRevealPinned = vi.fn();
    renderTable({ pinnedItems: [row('x')], onRevealPinned }, controlColumns);

    await userEvent.click(screen.getByRole('combobox', { name: 'Type for Row x' }));

    expect(onRevealPinned).not.toHaveBeenCalled();
  });

  it('ignores clicks when no reveal handler is given', async () => {
    renderTable({ pinnedItems: [row('x')] });

    await userEvent.click(screen.getByText('Row x'));

    expect(screen.getByText('Row x')).toBeInTheDocument();
  });
});

describe('TreeTable revealItem', () => {
  const tree: Row[] = [
    {
      id: 'root',
      name: 'Root',
      children: [{ id: 'worker', name: 'Worker', children: [row('gpu')] }],
    },
  ];
  const scrollTo = vi.fn();
  const originalScrollTo = Element.prototype.scrollTo;

  // The virtualizer scrolls to 0 on mount; a reveal is the call that asks for `behavior: 'auto'`.
  const revealCalls = () =>
    scrollTo.mock.calls.filter(([options]) => (options as ScrollToOptions).behavior === 'auto');

  beforeEach(() => {
    scrollTo.mockClear();
    Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
    // jsdom has no layout, and the virtualizer clamps offsets to the scroll height.
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 1000,
    });
  });

  afterEach(() => {
    Element.prototype.scrollTo = originalScrollTo;
    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
  });

  function table(props: {
    expanded: string[];
    revealItem?: { id: string; token: number };
    onSelectChange?: (item: Row | undefined) => void;
  }) {
    return (
      <TreeTable<Row>
        data={tree}
        columns={columns}
        virtualized
        rowHeight={ROW_HEIGHT}
        controlledExpandedIds={new Set(props.expanded)}
        revealItem={props.revealItem}
        onSelectChange={props.onSelectChange as never}
      />
    );
  }

  it('scrolls a visible row to the top of the tree', () => {
    render(table({ expanded: ['root', 'worker'], revealItem: { id: 'gpu', token: 1 } }));

    expect(revealCalls()).toEqual([[expect.objectContaining({ top: 2 * ROW_HEIGHT })]]);
  });

  it('selects the row it reveals', () => {
    const onSelectChange = vi.fn();
    render(
      table({
        expanded: ['root', 'worker'],
        revealItem: { id: 'gpu', token: 1 },
        onSelectChange,
      })
    );

    expect(onSelectChange).toHaveBeenCalledWith(expect.objectContaining({ id: 'gpu' }));
  });

  it('waits for a collapsed parent to be expanded before scrolling', () => {
    const revealItem = { id: 'gpu', token: 1 };
    const { rerender } = render(table({ expanded: ['root'], revealItem }));
    expect(revealCalls()).toHaveLength(0);

    rerender(table({ expanded: ['root', 'worker'], revealItem }));

    expect(revealCalls()).toEqual([[expect.objectContaining({ top: 2 * ROW_HEIGHT })]]);
  });

  it('reveals once per request, and again for a new request', () => {
    const first = { id: 'gpu', token: 1 };
    const { rerender } = render(table({ expanded: ['root', 'worker'], revealItem: first }));
    expect(revealCalls()).toHaveLength(1);

    rerender(table({ expanded: ['root', 'worker', 'extra'], revealItem: first }));
    expect(revealCalls()).toHaveLength(1);

    rerender(table({ expanded: ['root', 'worker'], revealItem: { id: 'gpu', token: 2 } }));
    expect(revealCalls()).toHaveLength(2);
  });

  it('does nothing for a row that is not in the tree', () => {
    render(table({ expanded: ['root', 'worker'], revealItem: { id: 'missing', token: 1 } }));

    expect(revealCalls()).toHaveLength(0);
  });
});
