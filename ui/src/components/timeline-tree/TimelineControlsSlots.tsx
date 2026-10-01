// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext } from 'react';

/** Elements in the query tab bar that the timeline renders its controls into. */
export interface TimelineControlsSlots {
  filters: HTMLElement | null;
  actions: HTMLElement | null;
}

/**
 * `null` means no tab bar hosts the controls, so the timeline draws its own bar.
 * Slots that are still `null` mean the tab bar hasn't mounted them yet.
 */
export const TimelineControlsSlotsContext = createContext<TimelineControlsSlots | null>(null);

export function useTimelineControlsSlots(): TimelineControlsSlots | null {
  return useContext(TimelineControlsSlotsContext);
}
