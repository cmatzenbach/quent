// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export interface RuleSelectionPlanInput {
  /** Node ids the rule matches right now. */
  matched: ReadonlySet<string>;
  /** Node ids the rule added to the selection earlier. */
  tracked: ReadonlySet<string>;
  /** Node ids currently selected, by click or by the rule. */
  selected: ReadonlySet<string>;
}

export interface RuleSelectionPlan {
  add: string[];
  remove: string[];
  /** The node ids the rule now owns. */
  tracked: Set<string>;
}

/**
 * Decides how to change the selection so a rule adds to it without touching
 * what the user picked by hand. A node the user deselected stays deselected
 * while the rule still matches it, and a node already selected by click is
 * never claimed, so clearing the rule leaves it selected.
 */
export function planRuleSelectionChanges({
  matched,
  tracked,
  selected,
}: RuleSelectionPlanInput): RuleSelectionPlan {
  const remove = [...tracked].filter(id => !matched.has(id) && selected.has(id));
  const add = [...matched].filter(id => !tracked.has(id) && !selected.has(id));
  const nextTracked = new Set([...tracked].filter(id => matched.has(id)));
  for (const id of add) {
    nextTracked.add(id);
  }
  return { add, remove, tracked: nextTracked };
}

const containsAll = (outer: ReadonlySet<string>, inner: ReadonlySet<string>): boolean =>
  [...inner].every(id => outer.has(id));

/**
 * Adding a selection merges by containment: a superset swallows the selections
 * inside it and a subset is ignored. A rule may only add a node when that
 * neither deletes a clicked selection nor gets dropped as a subset.
 */
export function canRuleAddSelection(
  operatorIds: ReadonlySet<string>,
  existing: ReadonlyMap<string, ReadonlySet<string>>,
  ruleOwned: ReadonlySet<string>
): boolean {
  for (const [selectionId, ids] of existing) {
    if (containsAll(ids, operatorIds)) {
      return false;
    }
    if (!ruleOwned.has(selectionId) && containsAll(operatorIds, ids)) {
      return false;
    }
  }
  return true;
}
