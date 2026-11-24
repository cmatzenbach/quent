// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { DAGNode, StatisticField } from '@quent/utils';
import { nodesToRuleOperators } from './ruleOperators';

const field = (key: string, value: StatisticField['value']): StatisticField => ({
  key,
  value,
  path: [[key, 0]],
});

const rolledUpNode = {
  id: 'node-1',
  label: 'Join',
  type: 'join',
  metadata: {
    rawNode: { id: 'op-a', operator_type_name: 'Join', instance_name: 'join A', plan_id: 'p1' },
    relatedOperators: [
      { id: 'op-a', operator_type_name: 'Join', instance_name: 'join A', plan_id: 'p1' },
      { id: 'op-b', operator_type_name: 'Join', instance_name: 'join B', plan_id: 'p1' },
    ],
    relatedOperatorStatistics: [
      { statistics: [], fields: [field('rows', 10), field('label', 'x')] },
      { statistics: [], fields: [field('rows', BigInt(20))] },
    ],
    operatorPlanLabels: { 'op-a': 'Plan 1', 'op-b': 'Plan 1' },
    operatorWorkerLabels: { 'op-a': 'Worker 1' },
  },
} as unknown as DAGNode;

const plainNode = {
  id: 'node-2',
  label: 'Scan',
  type: 'scan',
  metadata: {
    rawNode: { id: 'node-2', operator_type_name: 'Scan', instance_name: 'scan', plan_id: 'p1' },
    operatorStatistics: { statistics: [], fields: [field('rows', 7)] },
  },
} as unknown as DAGNode;

describe('nodesToRuleOperators', () => {
  it('flattens a rolled-up node into one record per related operator', () => {
    const result = nodesToRuleOperators([rolledUpNode]);
    expect(result.map(operator => operator.id)).toEqual(['op-a', 'op-b']);
    expect(result.every(operator => operator.nodeId === 'node-1')).toBe(true);
  });

  it('keeps only numeric statistics and converts bigint values', () => {
    const [first, second] = nodesToRuleOperators([rolledUpNode]);
    expect(first.stats).toEqual({ rows: 10 });
    expect(second.stats).toEqual({ rows: 20 });
  });

  it('uses plan and worker labels, falling back to the raw plan id', () => {
    const [first, second] = nodesToRuleOperators([rolledUpNode]);
    expect(first).toMatchObject({ plan: 'Plan 1', worker: 'Worker 1', typeName: 'Join' });
    expect(second.worker).toBeUndefined();
    expect(nodesToRuleOperators([plainNode])[0].plan).toBe('p1');
  });

  it('treats a node without related operators as a single operator', () => {
    const [only] = nodesToRuleOperators([plainNode]);
    expect(only).toMatchObject({
      id: 'node-2',
      nodeId: 'node-2',
      name: 'scan',
      stats: { rows: 7 },
    });
  });

  it('skips nodes without operator metadata', () => {
    expect(nodesToRuleOperators([{ id: 'x', label: 'x', type: 'x' }])).toEqual([]);
  });
});
