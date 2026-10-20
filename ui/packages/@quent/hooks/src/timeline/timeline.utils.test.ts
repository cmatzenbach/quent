// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';
import type { OperatorFilter, ResourceTimeline, TimelineRequest } from '@quent/utils';
import {
  getResourceTypeName,
  getFsmTypeName,
  bulkEntryId,
  setOperatorOnEntry,
  isTimelineUtilizationAllZero,
  mergeExtraBulkEntries,
} from './timeline.utils';

function makeResourceRequest(
  resourceId: string,
  entityTypeName: string | null = null,
  operatorId: string | null = null
): TimelineRequest<OperatorFilter> {
  return {
    Resource: {
      resource_id: resourceId,
      long_entities_threshold_s: null,
      entity_filter: { entity_type_name: entityTypeName },
      application: { operator_ids: operatorId ? [operatorId] : [] },
      config: { window_start_s: 0, window_end_s: 1, num_bins: 10 } as never,
    },
  };
}

function makeGroupRequest(
  groupId: string,
  resourceTypeName: string,
  entityTypeName: string | null = null,
  operatorId: string | null = null
): TimelineRequest<OperatorFilter> {
  return {
    ResourceGroup: {
      resource_group_id: groupId,
      resource_type_name: resourceTypeName,
      long_entities_threshold_s: null,
      entity_filter: { entity_type_name: entityTypeName },
      app_params: { operator_ids: operatorId ? [operatorId] : [] },
      config: { window_start_s: 0, window_end_s: 1, num_bins: 10 } as never,
    },
  };
}

describe('getResourceTypeName', () => {
  it('returns empty string for undefined', () => {
    expect(getResourceTypeName(undefined)).toBe('');
  });

  it('returns empty string for a Resource variant', () => {
    expect(getResourceTypeName(makeResourceRequest('res-1'))).toBe('');
  });

  it('returns resource_type_name for a ResourceGroup variant', () => {
    expect(getResourceTypeName(makeGroupRequest('g1', 'GPU'))).toBe('GPU');
  });

  it('returns an empty string when resource_type_name is empty', () => {
    expect(getResourceTypeName(makeGroupRequest('g1', ''))).toBe('');
  });
});

describe('getFsmTypeName', () => {
  it('returns entity_type_name from a Resource variant', () => {
    expect(getFsmTypeName(makeResourceRequest('r1', 'QueryOperator'))).toBe('QueryOperator');
  });

  it('returns null entity_type_name from a Resource variant', () => {
    expect(getFsmTypeName(makeResourceRequest('r1', null))).toBeNull();
  });

  it('returns entity_type_name from a ResourceGroup variant', () => {
    expect(getFsmTypeName(makeGroupRequest('g1', 'GPU', 'Worker'))).toBe('Worker');
  });

  it('returns null entity_type_name from a ResourceGroup variant', () => {
    expect(getFsmTypeName(makeGroupRequest('g1', 'GPU', null))).toBeNull();
  });
});

describe('bulkEntryId', () => {
  it('returns "<resourceId>:base" when operatorIds are omitted', () => {
    expect(bulkEntryId('res-1')).toBe('res-1:base');
  });

  it('returns "<resourceId>:base" when operatorIds are undefined', () => {
    expect(bulkEntryId('res-1', undefined)).toBe('res-1:base');
  });

  it('returns "<resourceId>:base" when operatorIds are null', () => {
    expect(bulkEntryId('res-1', null)).toBe('res-1:base');
  });

  it('returns a canonical key when operatorIds are provided', () => {
    expect(bulkEntryId('res-1', ['op-42', 'op-41', 'op-42'])).toBe('res-1:ops:["op-41","op-42"]');
  });
});

describe('isTimelineUtilizationAllZero', () => {
  it('returns true for a Binned variant with only zero values', () => {
    const data: ResourceTimeline = {
      Binned: { capacities_values: { count: [0, 0, 0] }, long_fsms: [] } as never,
    };
    expect(isTimelineUtilizationAllZero(data)).toBe(true);
  });

  it('returns false for a Binned variant with a non-zero value', () => {
    const data: ResourceTimeline = {
      Binned: { capacities_values: { count: [0, 1, 0] }, long_fsms: [] } as never,
    };
    expect(isTimelineUtilizationAllZero(data)).toBe(false);
  });

  it('returns true for a BinnedByState variant with only zero values', () => {
    const data: ResourceTimeline = {
      BinnedByState: {
        capacities_states_values: { count: { idle: [0, 0], busy: [0, 0] } },
        long_fsms: [],
      } as never,
    };
    expect(isTimelineUtilizationAllZero(data)).toBe(true);
  });

  it('returns false for a BinnedByState variant with a non-zero value', () => {
    const data: ResourceTimeline = {
      BinnedByState: {
        capacities_states_values: { count: { idle: [0, 0], busy: [0, 2] } },
        long_fsms: [],
      } as never,
    };
    expect(isTimelineUtilizationAllZero(data)).toBe(false);
  });
});

describe('setOperatorOnEntry', () => {
  it('sets operator_ids on a Resource variant', () => {
    const entry = makeResourceRequest('r1', null, null);
    const result = setOperatorOnEntry(entry, ['op-98', 'op-99']);
    expect('Resource' in result).toBe(true);
    expect(
      (result as { Resource: { application: OperatorFilter } }).Resource.application.operator_ids
    ).toEqual(['op-98', 'op-99']);
  });

  it('preserves other Resource fields when setting operator_ids', () => {
    const entry = makeResourceRequest('r1', 'Fsm', null);
    const result = setOperatorOnEntry(entry, ['op-1']);
    if (!('Resource' in result)) {
      throw new Error('expected Resource');
    }
    expect(result.Resource.resource_id).toBe('r1');
    expect(result.Resource.entity_filter.entity_type_name).toBe('Fsm');
  });

  it('does not mutate the original Resource entry', () => {
    const entry = makeResourceRequest('r1');
    const original = (entry as { Resource: { application: OperatorFilter } }).Resource.application
      .operator_ids;
    setOperatorOnEntry(entry, ['op-new']);
    expect(
      (entry as { Resource: { application: OperatorFilter } }).Resource.application.operator_ids
    ).toEqual(original);
  });

  it('sets operator_ids on a ResourceGroup variant', () => {
    const entry = makeGroupRequest('g1', 'GPU', null, null);
    const result = setOperatorOnEntry(entry, ['op-7', 'op-8']);
    expect('ResourceGroup' in result).toBe(true);
    expect(
      (result as { ResourceGroup: { app_params: OperatorFilter } }).ResourceGroup.app_params
        .operator_ids
    ).toEqual(['op-7', 'op-8']);
  });

  it('preserves other ResourceGroup fields when setting operator_ids', () => {
    const entry = makeGroupRequest('g1', 'GPU', 'Worker', null);
    const result = setOperatorOnEntry(entry, ['op-2']);
    if (!('ResourceGroup' in result)) {
      throw new Error('expected ResourceGroup');
    }
    expect(result.ResourceGroup.resource_group_id).toBe('g1');
    expect(result.ResourceGroup.resource_type_name).toBe('GPU');
    expect(result.ResourceGroup.entity_filter.entity_type_name).toBe('Worker');
  });

  it('does not mutate the original ResourceGroup entry', () => {
    const entry = makeGroupRequest('g1', 'GPU');
    const original = (entry as { ResourceGroup: { app_params: OperatorFilter } }).ResourceGroup
      .app_params.operator_ids;
    setOperatorOnEntry(entry, ['op-new']);
    expect(
      (entry as { ResourceGroup: { app_params: OperatorFilter } }).ResourceGroup.app_params
        .operator_ids
    ).toEqual(original);
  });
});

describe('mergeExtraBulkEntries', () => {
  const buildParams = (item: { id: string }) => makeResourceRequest(item.id);

  it('adds entries for extra items that are not already requested', () => {
    const base = { 'gpu-0': makeResourceRequest('gpu-0') };

    const merged = mergeExtraBulkEntries(base, [{ id: 'gpu-7' }], buildParams);

    expect(Object.keys(merged).sort()).toEqual(['gpu-0', 'gpu-7']);
    expect(merged['gpu-7']).toEqual(makeResourceRequest('gpu-7'));
  });

  it('keeps the existing entry and skips building one when the id is already requested', () => {
    const existing = makeResourceRequest('gpu-0', 'Existing');
    const build = vi.fn(buildParams);

    const merged = mergeExtraBulkEntries({ 'gpu-0': existing }, [{ id: 'gpu-0' }], build);

    expect(merged['gpu-0']).toBe(existing);
    expect(build).not.toHaveBeenCalled();
  });

  it('returns the same object when nothing needs to be added', () => {
    const base = { 'gpu-0': makeResourceRequest('gpu-0') };

    expect(mergeExtraBulkEntries(base, [], buildParams)).toBe(base);
    expect(mergeExtraBulkEntries(base, [{ id: 'gpu-0' }], buildParams)).toBe(base);
  });

  it('does not mutate the base entries', () => {
    const base = { 'gpu-0': makeResourceRequest('gpu-0') };

    mergeExtraBulkEntries(base, [{ id: 'gpu-7' }], buildParams);

    expect(Object.keys(base)).toEqual(['gpu-0']);
  });

  it('adds a repeated extra id only once', () => {
    const build = vi.fn(buildParams);

    const merged = mergeExtraBulkEntries({}, [{ id: 'gpu-7' }, { id: 'gpu-7' }], build);

    expect(Object.keys(merged)).toEqual(['gpu-7']);
    expect(build).toHaveBeenCalledTimes(1);
  });
});
