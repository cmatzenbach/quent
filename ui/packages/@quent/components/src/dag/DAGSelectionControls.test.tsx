// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider, createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { useOperatorRule, type RuleOperator } from '@quent/hooks';
import type { StatisticField } from '@quent/utils';
import { DAGSelectionControls } from './DAGSelectionControls';

const operator = (id: string, typeName: string, plan: string, worker?: string): RuleOperator => ({
  id,
  nodeId: id,
  name: id,
  typeName,
  plan,
  worker,
  stats: {},
});

const operators = [
  operator('a', 'Scan', 'Plan 1', 'Worker 1'),
  operator('b', 'Join', 'Plan 1', 'Worker 2'),
  operator('c', 'Join', 'Plan 2', 'Worker 2'),
];

const fields: StatisticField[] = [{ key: 'rows', value: 1, path: [['rows', 0]] }];

function RuleProbe() {
  const [rule] = useOperatorRule();
  return <output data-testid="rule">{JSON.stringify(rule)}</output>;
}

const renderControls = (matchedNodeCount = 0) =>
  render(
    <Provider store={createStore()}>
      <DAGSelectionControls
        operators={operators}
        operatorStatFields={fields}
        matchedNodeCount={matchedNodeCount}
      />
      <RuleProbe />
    </Provider>
  );

const rule = () => JSON.parse(screen.getByTestId('rule').textContent ?? '{}');

describe('DAGSelectionControls', () => {
  it('lists the query operator types and writes the chosen ones into the rule', async () => {
    const user = userEvent.setup();
    renderControls();

    await user.click(screen.getByRole('combobox', { name: 'Operator type' }));
    await user.click(await screen.findByText('Join'));

    expect(rule().typeNames).toEqual(['Join']);
  });

  it('writes the name filter into the rule', async () => {
    const user = userEvent.setup();
    renderControls();

    await user.type(screen.getByRole('textbox', { name: 'Name contains' }), 'hash');

    expect(rule().search).toBe('hash');
  });

  it('adds a statistic condition built from dropdowns', async () => {
    const user = userEvent.setup();
    renderControls();

    await user.click(screen.getByRole('button', { name: 'Add condition' }));

    expect(rule().statConditions).toEqual([{ field: 'rows', mode: 'topN', value: 5 }]);
    expect(screen.getByRole('combobox', { name: 'Condition statistic' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Condition type' })).toBeInTheDocument();
  });

  it('shows the match count and clears every filter', async () => {
    const user = userEvent.setup();
    renderControls(3);

    await user.type(screen.getByRole('textbox', { name: 'Name contains' }), 'hash');
    expect(screen.getByText('3 nodes selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(rule().search).toBe('');
    expect(within(screen.getByTestId('rule')).queryByText('hash')).toBeNull();
  });
});
