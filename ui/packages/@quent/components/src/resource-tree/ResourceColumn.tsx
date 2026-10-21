// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceGroup, Resource, cn, type FsmTypeSelection } from '@quent/utils';
import { TreeTableItem } from './types';
import { ResourceGroupRow } from './ResourceGroupRow';
import { ResourceRow } from './ResourceRow';
import { DataText } from '../ui/data-text';

type ResourceColumnProps = {
  item: TreeTableItem;
  selectedType: string;
  onTypeChange: (itemId: string, type: string) => void;
  availableFsmTypes?: FsmTypeSelection[];
  selectedFsmType?: string | null;
  onFsmChange?: (itemId: string, fsmType: string | null) => void;
  className?: string;
  verbose?: boolean;
  /** Worker the row belongs to; shown under the name and type when given. */
  workerName?: string;
};

/** Tree table column cell showing either a ResourceGroupRow or ResourceRow. */
export function ResourceColumn({
  item,
  selectedType,
  onTypeChange,
  availableFsmTypes,
  selectedFsmType,
  onFsmChange,
  className,
  workerName,
}: ResourceColumnProps): React.ReactNode {
  return (
    <div className={cn('text-foreground flex truncate items-center', className)}>
      <div>{item.icon && <item.icon className="h-4 w-4 shrink-0 mr-4" />}</div>
      <div>
        {item?.children?.length ? (
          <ResourceGroupRow
            group={item.entity as ResourceGroup}
            id={item.id}
            availableResourceTypes={item.availableResourceTypes}
            selectedType={selectedType}
            onTypeChange={onTypeChange}
            availableFsmTypes={availableFsmTypes}
            selectedFsmType={selectedFsmType}
            onFsmChange={onFsmChange}
          />
        ) : (
          <ResourceRow resource={item.entity as Resource} />
        )}
        {workerName && (
          <p className="mt-0.5 text-[11px] font-normal leading-none text-muted-foreground">
            Worker: <DataText className="text-foreground">{workerName}</DataText>
          </p>
        )}
      </div>
    </div>
  );
}
