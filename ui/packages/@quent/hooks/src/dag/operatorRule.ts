// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const STAT_CONDITION_MODE = {
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  TOP_N: 'topN',
  ABOVE_MEDIAN: 'aboveMedian',
} as const;

export type StatConditionMode = (typeof STAT_CONDITION_MODE)[keyof typeof STAT_CONDITION_MODE];

/**
 * One statistic condition. `value` means a threshold for gt/lt, a count for
 * topN, and a multiple of the operator type's median for aboveMedian.
 */
export interface StatCondition {
  field: string;
  mode: StatConditionMode;
  value: number;
}

/** A portable selection rule. It holds names and numbers, never operator ids. */
export interface OperatorRule {
  search: string;
  typeNames: readonly string[];
  plans: readonly string[];
  workers: readonly string[];
  statConditions: readonly StatCondition[];
}

/** A physical operator flattened to what the rule needs. */
export interface RuleOperator {
  id: string;
  /** The DAG node this operator is rolled up into. */
  nodeId: string;
  name: string;
  typeName: string;
  plan: string;
  worker?: string;
  stats: Readonly<Record<string, number>>;
}

export interface OperatorRuleMatch {
  nodeIds: Set<string>;
  /** Every operator of each matched node, so rolled-up nodes select fully. */
  operatorIds: Set<string>;
}

export const EMPTY_OPERATOR_RULE: OperatorRule = {
  search: '',
  typeNames: [],
  plans: [],
  workers: [],
  statConditions: [],
};

export function isOperatorRuleEmpty(rule: OperatorRule): boolean {
  return (
    rule.search.trim() === '' &&
    rule.typeNames.length === 0 &&
    rule.plans.length === 0 &&
    rule.workers.length === 0 &&
    rule.statConditions.length === 0
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Comma separates alternatives; spaces within one alternative must all match. */
function matchesSearch(search: string, operator: RuleOperator): boolean {
  const groups = search
    .toLowerCase()
    .split(',')
    .map(group => group.split(/\s+/).filter(Boolean))
    .filter(terms => terms.length > 0);
  if (groups.length === 0) {
    return true;
  }
  const haystack = `${operator.id} ${operator.name} ${operator.typeName}`.toLowerCase();
  return groups.some(terms => terms.every(term => haystack.includes(term)));
}

function matchesFacets(rule: OperatorRule, operator: RuleOperator): boolean {
  if (rule.typeNames.length > 0) {
    const type = operator.typeName.toLowerCase();
    if (!rule.typeNames.some(name => name.toLowerCase() === type)) {
      return false;
    }
  }
  if (rule.plans.length > 0 && !rule.plans.includes(operator.plan)) {
    return false;
  }
  if (
    rule.workers.length > 0 &&
    (operator.worker === undefined || !rule.workers.includes(operator.worker))
  ) {
    return false;
  }
  return matchesSearch(rule.search, operator);
}

/** The operator ids that satisfy one statistic condition across the whole query. */
function operatorsPassingCondition(
  condition: StatCondition,
  operators: readonly RuleOperator[]
): Set<string> {
  const withValue = operators.flatMap(operator => {
    const value = operator.stats[condition.field];
    return value === undefined || !Number.isFinite(value) ? [] : [{ operator, value }];
  });

  switch (condition.mode) {
    case STAT_CONDITION_MODE.GREATER_THAN:
      return new Set(withValue.filter(e => e.value > condition.value).map(e => e.operator.id));
    case STAT_CONDITION_MODE.LESS_THAN:
      return new Set(withValue.filter(e => e.value < condition.value).map(e => e.operator.id));
    case STAT_CONDITION_MODE.TOP_N: {
      const count = Math.max(0, Math.floor(condition.value));
      const ranked = [...withValue].sort((a, b) => b.value - a.value).slice(0, count);
      return new Set(ranked.map(e => e.operator.id));
    }
    case STAT_CONDITION_MODE.ABOVE_MEDIAN: {
      const valuesByType = new Map<string, number[]>();
      for (const { operator, value } of withValue) {
        const key = operator.typeName.toLowerCase();
        valuesByType.set(key, [...(valuesByType.get(key) ?? []), value]);
      }
      const medians = new Map(
        [...valuesByType].map(([type, values]) => [type, median(values)] as const)
      );
      return new Set(
        withValue
          .filter(
            e =>
              e.value >
              (medians.get(e.operator.typeName.toLowerCase()) ?? Infinity) * condition.value
          )
          .map(e => e.operator.id)
      );
    }
  }
}

/**
 * Applies a rule to a query's operators. Fields and conditions are ANDed.
 * A rolled-up node matches when any of its operators matches.
 */
export function matchOperatorRule(
  rule: OperatorRule,
  operators: readonly RuleOperator[]
): OperatorRuleMatch {
  if (isOperatorRuleEmpty(rule)) {
    return { nodeIds: new Set(), operatorIds: new Set() };
  }

  const conditionPasses = rule.statConditions.map(condition =>
    operatorsPassingCondition(condition, operators)
  );
  const matchedNodeIds = new Set(
    operators
      .filter(
        operator =>
          matchesFacets(rule, operator) &&
          conditionPasses.every(passing => passing.has(operator.id))
      )
      .map(operator => operator.nodeId)
  );

  return {
    nodeIds: matchedNodeIds,
    operatorIds: new Set(
      operators.filter(operator => matchedNodeIds.has(operator.nodeId)).map(operator => operator.id)
    ),
  };
}
