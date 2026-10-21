// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResourceColumn } from './ResourceColumn';
import type { TreeTableItem } from './types';

const resourceItem = {
  id: 'res-1',
  type: 'Resource',
  entity: { id: 'res-1', instance_name: 'Storage', type_name: 'storage' },
  children: [],
} as unknown as TreeTableItem;

const groupItem = {
  id: 'group-1',
  type: 'ResourceGroup',
  entity: { id: 'group-1', instance_name: 'task-executor', type_name: 'TaskExecutor' },
  children: [resourceItem],
} as unknown as TreeTableItem;

function renderColumn(item: TreeTableItem, workerName?: string) {
  render(
    <ResourceColumn
      item={item}
      selectedType="storage"
      onTypeChange={vi.fn()}
      workerName={workerName}
    />
  );
}

describe('ResourceColumn worker line', () => {
  it('shows no worker line by default', () => {
    renderColumn(resourceItem);

    expect(screen.queryByText('Worker:')).not.toBeInTheDocument();
  });

  it('shows the worker under a resource', () => {
    renderColumn(resourceItem, 'worker-0');

    expect(screen.getByText('Worker:')).toBeInTheDocument();
    expect(screen.getByText('worker-0')).toBeInTheDocument();
  });

  it('puts the worker in the same column as the name and type so the text lines up', () => {
    renderColumn(resourceItem, 'worker-0');

    const nameColumn = screen.getByText('Storage').closest('div')?.parentElement;
    expect(nameColumn).toContainElement(screen.getByText('Worker:'));
    expect(screen.getByText('Worker:').closest('div')).toBe(nameColumn);
  });

  it('shows the worker under a resource group', () => {
    renderColumn(groupItem, 'worker-1');

    expect(screen.getByText('Worker:')).toBeInTheDocument();
    expect(screen.getByText('worker-1')).toBeInTheDocument();
  });
});
