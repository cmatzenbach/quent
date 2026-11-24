// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  EMPTY_OPERATOR_RULE,
  isOperatorRuleEmpty,
  matchOperatorRule,
  type OperatorRule,
  type RuleOperator,
} from './operatorRule';

const op = (
  id: string,
  nodeId: string,
  typeName: string,
  stats: Record<string, number> = {},
  extra: Partial<RuleOperator> = {}
): RuleOperator => ({
  id,
  nodeId,
  name: id,
  typeName,
  plan: 'plan-a',
  worker: 'worker-1',
  stats,
  ...extra,
});

const rule = (overrides: Partial<OperatorRule>): OperatorRule => ({
  ...EMPTY_OPERATOR_RULE,
  ...overrides,
});

const operators: RuleOperator[] = [
  op('scan-1', 'n1', 'Scan', { rows: 100 }),
  op('scan-2', 'n2', 'Scan', { rows: 900 }, { plan: 'plan-b', worker: 'worker-2' }),
  op('join-1', 'n3', 'Join', { rows: 50 }),
  op('join-2a', 'n4', 'Join', { rows: 10 }),
  op('join-2b', 'n4', 'Join', { rows: 5000 }),
];

describe('isOperatorRuleEmpty', () => {
  it('is true for the empty rule and false once any filter is set', () => {
    expect(isOperatorRuleEmpty(EMPTY_OPERATOR_RULE)).toBe(true);
    expect(isOperatorRuleEmpty(rule({ typeNames: ['Scan'] }))).toBe(false);
  });
});

describe('matchOperatorRule', () => {
  it('matches nothing for an empty rule', () => {
    const result = matchOperatorRule(EMPTY_OPERATOR_RULE, operators);
    expect(result.nodeIds.size).toBe(0);
    expect(result.operatorIds.size).toBe(0);
  });

  it('filters by operator type case-insensitively, ORing values', () => {
    const result = matchOperatorRule(rule({ typeNames: ['scan'] }), operators);
    expect(result.nodeIds).toEqual(new Set(['n1', 'n2']));
  });

  it('filters by plan and worker, ANDed with other fields', () => {
    expect(matchOperatorRule(rule({ plans: ['plan-b'] }), operators).nodeIds).toEqual(
      new Set(['n2'])
    );
    expect(matchOperatorRule(rule({ workers: ['worker-2'] }), operators).nodeIds).toEqual(
      new Set(['n2'])
    );
    expect(
      matchOperatorRule(rule({ typeNames: ['Join'], plans: ['plan-b'] }), operators).nodeIds.size
    ).toBe(0);
  });

  it('searches name with comma as OR and space as AND', () => {
    const named = [
      op('hash join', 'a', 'Join'),
      op('hash agg', 'b', 'Agg'),
      op('sort', 'c', 'Sort'),
    ];
    expect(matchOperatorRule(rule({ search: 'hash' }), named).nodeIds).toEqual(new Set(['a', 'b']));
    expect(matchOperatorRule(rule({ search: 'hash join' }), named).nodeIds).toEqual(new Set(['a']));
    expect(matchOperatorRule(rule({ search: 'sort, agg' }), named).nodeIds).toEqual(
      new Set(['b', 'c'])
    );
  });

  it('applies absolute greater-than and less-than conditions', () => {
    const gt = rule({ statConditions: [{ field: 'rows', mode: 'gt', value: 80 }] });
    expect(matchOperatorRule(gt, operators).nodeIds).toEqual(new Set(['n1', 'n2', 'n4']));
    const lt = rule({ statConditions: [{ field: 'rows', mode: 'lt', value: 60 }] });
    expect(matchOperatorRule(lt, operators).nodeIds).toEqual(new Set(['n3', 'n4']));
  });

  it('selects the top N operators by a statistic', () => {
    const top = rule({ statConditions: [{ field: 'rows', mode: 'topN', value: 2 }] });
    expect(matchOperatorRule(top, operators).nodeIds).toEqual(new Set(['n4', 'n2']));
  });

  it('selects operators above a multiple of their type median', () => {
    // Join median of [50, 10, 5000] is 50; Scan median of [100, 900] is 500.
    const above = rule({ statConditions: [{ field: 'rows', mode: 'aboveMedian', value: 1.5 }] });
    expect(matchOperatorRule(above, operators).nodeIds).toEqual(new Set(['n2', 'n4']));
  });

  it('ignores operators missing the statistic', () => {
    const withMissing = [...operators, op('bare', 'n5', 'Scan')];
    const gt = rule({ statConditions: [{ field: 'rows', mode: 'gt', value: 0 }] });
    expect(matchOperatorRule(gt, withMissing).nodeIds.has('n5')).toBe(false);
  });

  it('selects a rolled-up node when any operator matches and returns all its operators', () => {
    const gt = rule({ statConditions: [{ field: 'rows', mode: 'gt', value: 1000 }] });
    const result = matchOperatorRule(gt, operators);
    expect(result.nodeIds).toEqual(new Set(['n4']));
    expect(result.operatorIds).toEqual(new Set(['join-2a', 'join-2b']));
  });
});
