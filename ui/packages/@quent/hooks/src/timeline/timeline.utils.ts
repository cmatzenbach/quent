// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TimelineRequest, OperatorFilter, ResourceTimeline } from '@quent/utils';
export { getFsmTypeName, getResourceTypeName } from '@quent/utils';

/** True when every binned capacity value in a resource timeline is zero (no utilization at all). */
export function isTimelineUtilizationAllZero(data: ResourceTimeline): boolean {
  const valueLists =
    'Binned' in data
      ? Object.values(data.Binned.capacities_values)
      : Object.values(data.BinnedByState.capacities_states_values).flatMap(byState =>
          Object.values(byState)
        );
  return valueLists.every(values => values.every(value => value === 0));
}

/**
 * Add bulk entries for extra items (such as pinned rows under a collapsed parent) that the
 * expanded-tree walk did not request. Existing entries win. Returns `base` itself when nothing
 * is added so callers keep a stable reference.
 */
export function mergeExtraBulkEntries<T extends { id: string }>(
  base: Record<string, TimelineRequest<OperatorFilter>>,
  extraItems: readonly T[],
  buildParams: (item: T) => TimelineRequest<OperatorFilter>
): Record<string, TimelineRequest<OperatorFilter>> {
  let merged: Record<string, TimelineRequest<OperatorFilter>> | null = null;
  for (const item of extraItems) {
    if (item.id in base || (merged !== null && item.id in merged)) {
      continue;
    }
    merged ??= { ...base };
    merged[item.id] = buildParams(item);
  }
  return merged ?? base;
}

/** Canonicalize an operator filter for stable request and cache keys. */
export function canonicalOperatorIds(operatorIds?: readonly string[] | null): string[] {
  return [...new Set(operatorIds ?? [])].sort();
}

/** Stable request-entry key for bulk timeline fetches. Omit operatorIds for the base variant. */
export function bulkEntryId(resourceId: string, operatorIds?: readonly string[] | null): string {
  const canonicalIds = canonicalOperatorIds(operatorIds);
  return canonicalIds.length > 0
    ? `${resourceId}:ops:${JSON.stringify(canonicalIds)}`
    : `${resourceId}:base`;
}

/** Clone an entry and set its operator filter. */
export function setOperatorOnEntry(
  entry: TimelineRequest<OperatorFilter>,
  operatorIds: readonly string[]
): TimelineRequest<OperatorFilter> {
  if ('ResourceGroup' in entry) {
    return {
      ResourceGroup: {
        ...entry.ResourceGroup,
        app_params: { ...entry.ResourceGroup.app_params, operator_ids: [...operatorIds] },
      },
    };
  }
  return {
    Resource: {
      ...entry.Resource,
      application: { ...entry.Resource.application, operator_ids: [...operatorIds] },
    },
  };
}
