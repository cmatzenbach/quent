// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useAtom } from 'jotai';
import { operatorRuleAtom, ruleSelectedNodeIdsAtom } from '../atoms/operatorRule';

export const useOperatorRule = () => useAtom(operatorRuleAtom);
export const useRuleSelectedNodeIds = () => useAtom(ruleSelectedNodeIdsAtom);
