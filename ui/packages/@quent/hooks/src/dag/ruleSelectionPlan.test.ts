// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { canRuleAddSelection, planRuleSelectionChanges } from './ruleSelectionPlan';

const ids = (...values: string[]) => new Set(values);

describe('planRuleSelectionChanges', () => {
  it('adds matched nodes that are not selected yet and tracks them', () => {
    const plan = planRuleSelectionChanges({
      matched: ids('a', 'b'),
      tracked: ids(),
      selected: ids(),
    });
    expect([...plan.add].sort()).toEqual(['a', 'b']);
    expect(plan.remove).toEqual([]);
    expect(plan.tracked).toEqual(ids('a', 'b'));
  });

  it('removes tracked nodes the rule no longer matches', () => {
    const plan = planRuleSelectionChanges({
      matched: ids('a'),
      tracked: ids('a', 'b'),
      selected: ids('a', 'b'),
    });
    expect(plan.remove).toEqual(['b']);
    expect(plan.add).toEqual([]);
    expect(plan.tracked).toEqual(ids('a'));
  });

  it('leaves a click-selected node alone and does not claim it', () => {
    const plan = planRuleSelectionChanges({
      matched: ids('a'),
      tracked: ids(),
      selected: ids('a'),
    });
    expect(plan.add).toEqual([]);
    expect(plan.tracked).toEqual(ids());

    const cleared = planRuleSelectionChanges({
      matched: ids(),
      tracked: plan.tracked,
      selected: ids('a'),
    });
    expect(cleared.remove).toEqual([]);
  });

  it('does not re-add a node the user deselected while it still matches', () => {
    const plan = planRuleSelectionChanges({
      matched: ids('a', 'b'),
      tracked: ids('a', 'b'),
      selected: ids('a'),
    });
    expect(plan.add).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.tracked).toEqual(ids('a', 'b'));
  });
});

describe('canRuleAddSelection', () => {
  const existing = new Map([
    ['clicked', new Set(['c1', 'c2'])],
    ['owned', new Set(['o1'])],
  ]);

  it('allows an unrelated node', () => {
    expect(canRuleAddSelection(new Set(['x']), existing, new Set(['owned']))).toBe(true);
  });

  it('refuses a node that would absorb a clicked selection', () => {
    expect(canRuleAddSelection(new Set(['c1', 'c2', 'c3']), existing, new Set(['owned']))).toBe(
      false
    );
  });

  it('refuses a node already contained in an existing selection', () => {
    expect(canRuleAddSelection(new Set(['c1']), existing, new Set(['owned']))).toBe(false);
  });

  it('allows a node that absorbs only a selection the rule owns', () => {
    expect(canRuleAddSelection(new Set(['o1', 'o2']), existing, new Set(['owned']))).toBe(true);
  });
});
