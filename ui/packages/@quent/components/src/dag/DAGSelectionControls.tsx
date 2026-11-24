// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import {
  EMPTY_OPERATOR_RULE,
  STAT_CONDITION_MODE,
  isOperatorRuleEmpty,
  useOperatorRule,
  type OperatorRule,
  type RuleOperator,
  type StatCondition,
  type StatConditionMode,
} from '@quent/hooks';
import { buildStatisticFieldPresentations, type StatisticField } from '@quent/utils';
import { Cpu, Gauge, Layers, Plus, Search, Server, X } from 'lucide-react';
import { Button } from '../ui/button';
import { ControlField, ControlGrid, ControlSection } from '../ui/control-grid';
import { Input } from '../ui/input';
import { OptionMultiSelect } from '../ui/option-multi-select';
import { SelectField, type SelectFieldOption } from '../ui/select-field';

interface DAGSelectionControlsProps {
  /** Every operator in the open query; the filter options come from these. */
  operators: readonly RuleOperator[];
  operatorStatFields: readonly StatisticField[];
  matchedNodeCount: number;
}

const DEFAULT_TOP_N = 5;

const MODE_OPTIONS: SelectFieldOption[] = [
  { value: STAT_CONDITION_MODE.TOP_N, label: 'Top N' },
  { value: STAT_CONDITION_MODE.ABOVE_MEDIAN, label: '× type median' },
  { value: STAT_CONDITION_MODE.GREATER_THAN, label: 'Greater than' },
  { value: STAT_CONDITION_MODE.LESS_THAN, label: 'Less than' },
];

function distinctSorted(values: Iterable<string | undefined>): string[] {
  return [...new Set([...values].filter((value): value is string => !!value))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function triggerText(selected: readonly string[]): string {
  if (selected.length === 0) {
    return 'Any';
  }
  return selected.length === 1 ? selected[0] : `${selected.length} selected`;
}

function toggled(values: readonly string[], value: string): string[] {
  return values.includes(value) ? values.filter(v => v !== value) : [...values, value];
}

interface FacetFieldProps {
  label: string;
  icon: typeof Cpu;
  options: string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}

function FacetField({ label, icon, options, selected, onChange }: FacetFieldProps) {
  return (
    <ControlField label={label} icon={icon}>
      <OptionMultiSelect
        ariaLabel={label}
        triggerText={triggerText(selected)}
        options={options.map(value => ({ value }))}
        selectedOptionIds={new Set(selected)}
        onToggleOption={value => onChange(toggled(selected, value))}
        onSelectAllOptions={() => onChange(options)}
        onSelectNoOptions={() => onChange([])}
        showSelectedBadges={false}
        triggerClassName="h-6 text-xs"
      />
    </ControlField>
  );
}

interface ConditionRowProps {
  condition: StatCondition;
  statOptions: SelectFieldOption[];
  onChange: (next: StatCondition) => void;
  onRemove: () => void;
}

function ConditionRow({ condition, statOptions, onChange, onRemove }: ConditionRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      <SelectField
        ariaLabel="Condition statistic"
        options={statOptions}
        value={condition.field}
        onValueChange={field => field && onChange({ ...condition, field })}
        clearable={false}
        triggerClassName="h-6 text-xs"
      />
      <SelectField
        ariaLabel="Condition type"
        options={MODE_OPTIONS}
        value={condition.mode}
        onValueChange={mode => mode && onChange({ ...condition, mode: mode as StatConditionMode })}
        clearable={false}
        triggerClassName="h-6 text-xs"
      />
      <Input
        type="number"
        aria-label="Condition value"
        className="h-6 w-20 text-xs"
        value={condition.value}
        onChange={event => {
          const value = event.target.valueAsNumber;
          onChange({ ...condition, value: Number.isFinite(value) ? value : 0 });
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Remove condition"
        onClick={onRemove}
      >
        <X />
      </Button>
    </div>
  );
}

/** Rule-based operator selection: dropdown filters that add matching DAG nodes to the selection. */
export function DAGSelectionControls({
  operators,
  operatorStatFields,
  matchedNodeCount,
}: DAGSelectionControlsProps) {
  const [rule, setRule] = useOperatorRule();

  const typeOptions = useMemo(() => distinctSorted(operators.map(o => o.typeName)), [operators]);
  const planOptions = useMemo(() => distinctSorted(operators.map(o => o.plan)), [operators]);
  const workerOptions = useMemo(() => distinctSorted(operators.map(o => o.worker)), [operators]);
  const statOptions = useMemo(() => {
    const presentations = buildStatisticFieldPresentations(operatorStatFields);
    return operatorStatFields.map(field => ({
      value: field.key,
      label: presentations.get(field.key)?.label ?? field.key,
      title: presentations.get(field.key)?.title,
    }));
  }, [operatorStatFields]);

  const update = (patch: Partial<OperatorRule>) => setRule({ ...rule, ...patch });
  const setCondition = (index: number, next: StatCondition) =>
    update({ statConditions: rule.statConditions.map((c, i) => (i === index ? next : c)) });
  const addCondition = () =>
    update({
      statConditions: [
        ...rule.statConditions,
        { field: statOptions[0].value, mode: STAT_CONDITION_MODE.TOP_N, value: DEFAULT_TOP_N },
      ],
    });
  const isEmpty = isOperatorRuleEmpty(rule);

  return (
    <ControlSection
      title="Selection"
      description="Add every operator matching these filters to the selection."
      action={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {!isEmpty && (
            <span>
              {matchedNodeCount} {matchedNodeCount === 1 ? 'node' : 'nodes'} selected
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={isEmpty}
            onClick={() => setRule(EMPTY_OPERATOR_RULE)}
          >
            Clear
          </Button>
        </div>
      }
    >
      <ControlGrid columns={2} minColumnWidth="12rem">
        <FacetField
          label="Operator type"
          icon={Cpu}
          options={typeOptions}
          selected={rule.typeNames}
          onChange={typeNames => update({ typeNames })}
        />
        {planOptions.length > 1 && (
          <FacetField
            label="Plan"
            icon={Layers}
            options={planOptions}
            selected={rule.plans}
            onChange={plans => update({ plans })}
          />
        )}
        {workerOptions.length > 1 && (
          <FacetField
            label="Worker"
            icon={Server}
            options={workerOptions}
            selected={rule.workers}
            onChange={workers => update({ workers })}
          />
        )}
        <ControlField label="Name contains" icon={Search}>
          <Input
            aria-label="Name contains"
            className="h-6 text-xs"
            placeholder="e.g. hash join"
            value={rule.search}
            onChange={event => update({ search: event.target.value })}
          />
        </ControlField>
        {statOptions.length > 0 && (
          <ControlField label="Statistic" icon={Gauge} align="start" className="col-span-full">
            <div className="space-y-1.5">
              {rule.statConditions.map((condition, index) => (
                <ConditionRow
                  key={index}
                  condition={condition}
                  statOptions={statOptions}
                  onChange={next => setCondition(index, next)}
                  onRemove={() =>
                    update({ statConditions: rule.statConditions.filter((_, i) => i !== index) })
                  }
                />
              ))}
              <Button type="button" variant="outline" size="xs" onClick={addCondition}>
                <Plus />
                Add condition
              </Button>
            </div>
          </ControlField>
        )}
      </ControlGrid>
    </ControlSection>
  );
}
