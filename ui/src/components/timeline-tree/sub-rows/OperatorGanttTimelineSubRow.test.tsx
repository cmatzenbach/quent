// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { operatorTimelineRowId, type TreeTableItem } from '@quent/components';
import { EntityTypeKey, type EntityRef, type QueryBundle } from '@quent/utils';
import { createOperatorGanttTimelineSubRow } from './OperatorGanttTimelineSubRow';

function item(id: string, type: string): TreeTableItem {
  return { id, type, entity: {} as TreeTableItem['entity'] };
}

const queryBundle = {
  duration_s: 1,
  plan_tree: { id: 'plan-1', worker: 'worker-1', children: [] },
  entities: { operators: {} },
} as unknown as QueryBundle<EntityRef>;

describe('createOperatorGanttTimelineSubRow', () => {
  const subRow = createOperatorGanttTimelineSubRow({ queryBundle, isDark: false });

  it('names the worker an Operators row belongs to', () => {
    expect(subRow.parentId(item(operatorTimelineRowId('worker-1'), 'operator-timeline'))).toBe(
      'worker-1'
    );
  });

  it('has no parent for a row that is not an Operators row', () => {
    expect(subRow.parentId(item('worker-1', EntityTypeKey.Resource))).toBeUndefined();
  });

  it('is labeled Operators', () => {
    expect(subRow.label).toBe('Operators');
  });
});
