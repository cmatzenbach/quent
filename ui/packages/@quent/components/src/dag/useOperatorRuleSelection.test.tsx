// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_OPERATOR_RULE,
  useOperatorRule,
  useOperatorSelection,
  useOperatorSelectionActions,
  type OperatorRule,
} from '@quent/hooks';
import type { DAGNode } from '@quent/utils';
import { useOperatorRuleSelection } from './useOperatorRuleSelection';

const node = (id: string, type: string): DAGNode =>
  ({
    id,
    label: id,
    type,
    metadata: {
      rawNode: { id, operator_type_name: type, instance_name: id, plan_id: 'p1' },
      operatorStatistics: { statistics: [], fields: [] },
    },
  }) as unknown as DAGNode;

const parent = {
  ...node('parent', 'Join'),
  metadata: {
    ...node('parent', 'Join').metadata,
    relatedOperatorIds: ['child'],
  },
} as unknown as DAGNode;

const nodes = [node('scan-1', 'Scan'), node('scan-2', 'Scan'), node('join-1', 'Join'), parent];

function setup() {
  const wrapper = ({ children }: PropsWithChildren) => (
    <Provider store={createStore()}>{children}</Provider>
  );
  const hook = renderHook(
    () => ({
      ruleSelection: useOperatorRuleSelection(nodes),
      setRule: useOperatorRule()[1],
      selection: useOperatorSelection(),
      apply: useOperatorSelectionActions(),
    }),
    { wrapper }
  );
  const selectedIds = () => new Set(hook.result.current.selection.selections.keys());
  const setRule = (rule: Partial<OperatorRule>) =>
    act(() => hook.result.current.setRule({ ...EMPTY_OPERATOR_RULE, ...rule }));
  return { hook, selectedIds, setRule };
}

describe('useOperatorRuleSelection', () => {
  it('selects the nodes a rule matches and removes them when the rule clears', () => {
    const { selectedIds, setRule } = setup();

    setRule({ typeNames: ['Scan'] });
    expect(selectedIds()).toEqual(new Set(['scan-1', 'scan-2']));

    setRule({});
    expect(selectedIds()).toEqual(new Set());
  });

  it('keeps a click-selected node when the rule is cleared', () => {
    const { hook, selectedIds, setRule } = setup();
    act(() =>
      hook.result.current.apply({
        type: 'add',
        selectionId: 'join-1',
        label: 'join-1',
        operatorIds: ['join-1'],
        selectedData: { nodeId: 'join-1', label: 'join-1', operationType: 'Join' } as never,
        detailAttention: 'none',
      })
    );

    setRule({ typeNames: ['Scan'] });
    expect(selectedIds()).toEqual(new Set(['join-1', 'scan-1', 'scan-2']));

    setRule({});
    expect(selectedIds()).toEqual(new Set(['join-1']));
  });

  it('does not re-select a node the user deselected while the rule still matches it', () => {
    const { hook, selectedIds, setRule } = setup();
    setRule({ typeNames: ['Scan'] });

    act(() => hook.result.current.apply({ type: 'remove', selectionId: 'scan-1' }));
    expect(selectedIds()).toEqual(new Set(['scan-2']));
  });

  it('does not delete a clicked node when a matched node would absorb it', () => {
    const { hook, selectedIds, setRule } = setup();
    act(() =>
      hook.result.current.apply({
        type: 'add',
        selectionId: 'child',
        label: 'child',
        operatorIds: ['child'],
        selectedData: { nodeId: 'child', label: 'child', operationType: 'Scan' } as never,
        detailAttention: 'none',
      })
    );

    // rolled-up node whose operators include the clicked one
    setRule({ search: 'parent' });
    expect(selectedIds()).toEqual(new Set(['child']));
    setRule({});
    expect(selectedIds()).toEqual(new Set(['child']));
  });

  it('reports the match count', () => {
    const { hook, setRule } = setup();
    setRule({ search: 'scan' });
    expect(hook.result.current.ruleSelection.matchedNodeCount).toBe(2);
  });
});
