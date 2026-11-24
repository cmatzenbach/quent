// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { atom } from 'jotai';
import { EMPTY_OPERATOR_RULE, type OperatorRule } from '../dag/operatorRule';

/** The active rule-based operator selection. Holds names and numbers, never operator ids. */
export const operatorRuleAtom = atom<OperatorRule>(EMPTY_OPERATOR_RULE);

/** DAG node ids the rule added to the selection, so the rule only removes what it added. */
export const ruleSelectedNodeIdsAtom = atom<ReadonlySet<string>>(new Set<string>());
