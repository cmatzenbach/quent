// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo } from 'react';
import {
  canRuleAddSelection,
  matchOperatorRule,
  planRuleSelectionChanges,
  useOperatorRule,
  useOperatorSelection,
  useOperatorSelectionActions,
  useRuleSelectedNodeIds,
  type RuleOperator,
} from '@quent/hooks';
import type { DAGNode } from '@quent/utils';
import { operatorSelectionFromNode } from './dagSelection';
import { nodesToRuleOperators } from './ruleOperators';

function sameMembers(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every(id => b.has(id));
}

/**
 * Applies the active selection rule to the DAG: matched nodes join the
 * selection next to anything the user clicked. Mount it somewhere that stays
 * alive while the settings popover is closed.
 */
export function useOperatorRuleSelection(nodes: readonly DAGNode[]): {
  operators: RuleOperator[];
  matchedNodeCount: number;
} {
  const [rule] = useOperatorRule();
  const [tracked, setTracked] = useRuleSelectedNodeIds();
  const selection = useOperatorSelection();
  const applySelectionAction = useOperatorSelectionActions();

  const operators = useMemo(() => nodesToRuleOperators(nodes), [nodes]);
  const match = useMemo(() => matchOperatorRule(rule, operators), [rule, operators]);

  const nodesById = useMemo(() => new Map(nodes.map(node => [node.id, node] as const)), [nodes]);

  useEffect(() => {
    const selectedIds = new Set(selection.selections.keys());
    const plan = planRuleSelectionChanges({
      matched: match.nodeIds,
      tracked,
      selected: selectedIds,
    });
    if (plan.add.length === 0 && plan.remove.length === 0 && sameMembers(plan.tracked, tracked)) {
      return;
    }

    for (const selectionId of plan.remove) {
      applySelectionAction({ type: 'remove', selectionId });
    }

    const existing = new Map(
      [...selection.selections].map(([id, { operatorIds }]) => [id, operatorIds] as const)
    );
    const nextTracked = new Set(plan.tracked);
    for (const nodeId of plan.add) {
      const node = nodesById.get(nodeId);
      const resolved = node && operatorSelectionFromNode(node);
      // Skip adds the selection would drop or that would swallow a clicked node.
      if (!resolved || !canRuleAddSelection(resolved.operatorIds, existing, tracked)) {
        nextTracked.delete(nodeId);
        continue;
      }
      applySelectionAction({ type: 'add', ...resolved, detailAttention: 'none' });
      existing.set(nodeId, resolved.operatorIds);
    }
    if (!sameMembers(nextTracked, tracked)) {
      setTracked(nextTracked);
    }
  }, [match, nodesById, selection, tracked, applySelectionAction, setTracked]);

  return { operators, matchedNodeCount: match.nodeIds.size };
}
