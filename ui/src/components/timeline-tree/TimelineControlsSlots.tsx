// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext } from 'react';

/** Elements in the query tab bar that the timeline renders its controls into. */
export interface TimelineControlsSlots {
  filters: HTMLElement | null;
  actions: HTMLElement | null;
}

/**
 * Null means no tab bar is hosting the controls, so the timeline draws its own bar.
 * A provider with empty slots means the tab bar has not mounted its slots yet.
 */
export const TimelineControlsSlotsContext = createContext<TimelineControlsSlots | null>(null);

export function useTimelineControlsSlots(): TimelineControlsSlots | null {
  return useContext(TimelineControlsSlotsContext);
}
