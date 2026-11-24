// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { RuleOperator } from '@quent/hooks';
import type { DAGNode, DAGStatisticSet, StatisticField } from '@quent/utils';
import type { QueryPlanNodeData } from '../query-plan/QueryPlanNode';

type NodeMetadata = NonNullable<QueryPlanNodeData['metadata']>;
type RawOperator = NonNullable<NodeMetadata['rawNode']>;

function numericStats(set: DAGStatisticSet | undefined): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const field of set?.fields ?? ([] as StatisticField[])) {
    if (typeof field.value === 'number' || typeof field.value === 'bigint') {
      stats[field.key] = Number(field.value);
    }
  }
  return stats;
}

function toRuleOperator(
  node: DAGNode,
  metadata: NodeMetadata,
  operator: RawOperator,
  statistics: DAGStatisticSet | undefined
): RuleOperator {
  return {
    id: operator.id,
    nodeId: node.id,
    name: operator.instance_name ?? operator.operator_type_name ?? node.label,
    typeName: operator.operator_type_name ?? node.type,
    plan: metadata.operatorPlanLabels?.[operator.id] ?? operator.plan_id ?? '',
    worker: metadata.operatorWorkerLabels?.[operator.id],
    stats: numericStats(statistics),
  };
}

/** Flattens DAG nodes into the per-operator records the selection rule matches on. */
export function nodesToRuleOperators(nodes: readonly DAGNode[]): RuleOperator[] {
  return nodes.flatMap(node => {
    const metadata = node.metadata as NodeMetadata | undefined;
    if (!metadata) {
      return [];
    }
    if (metadata.relatedOperators?.length) {
      return metadata.relatedOperators.map((operator, index) =>
        toRuleOperator(node, metadata, operator, metadata.relatedOperatorStatistics?.[index])
      );
    }
    return metadata.rawNode
      ? [toRuleOperator(node, metadata, metadata.rawNode, metadata.operatorStatistics)]
      : [];
  });
}
