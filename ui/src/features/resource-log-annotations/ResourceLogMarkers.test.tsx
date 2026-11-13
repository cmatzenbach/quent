// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ResourceLogEntry } from './logAnnotations';
import { ResourceLogMarkers } from './ResourceLogMarkers';

const setPlayheadLineTimeMs = vi.fn();
const setPlayheadTimeS = vi.fn();
const setIsPlaying = vi.fn();

vi.mock('@quent/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@quent/hooks')>();
  return {
    ...actual,
    useZoomRange: () => ({ start: 0, end: 100 }),
    useSetDataFlowIsPlaying: () => setIsPlaying,
    useSetPlayheadLineTimeMs: () => setPlayheadLineTimeMs,
    useSetPlayheadTimeS: () => setPlayheadTimeS,
  };
});

const logs: ResourceLogEntry[] = [
  {
    id: 'one',
    resourceId: 'resource-1',
    timestampSeconds: 10,
    severity: 'info',
    source: 'runtime',
    message: 'First message',
  },
  {
    id: 'two',
    resourceId: 'resource-1',
    timestampSeconds: 10.5,
    severity: 'warning',
    source: 'runtime',
    message: 'Second message',
  },
  {
    id: 'three',
    resourceId: 'resource-1',
    timestampSeconds: 80,
    severity: 'error',
    source: 'runtime',
    message: 'Third message',
  },
];

describe('ResourceLogMarkers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 300,
      height: 45,
      top: 0,
      left: 0,
      right: 300,
      bottom: 45,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
  });

  it('renders a numbered cluster and a single flying-v marker', () => {
    render(<ResourceLogMarkers logs={logs} selectedLogIds={[]} onSelect={vi.fn()} />);

    expect(screen.getByRole('button', { name: /2 logs/i })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /error log.*80\.000/i })).toHaveAttribute(
      'data-marker-shape',
      'flying-v'
    );
  });

  it('selects stable log ids and moves the shared playhead', () => {
    const onSelect = vi.fn();
    render(<ResourceLogMarkers logs={logs} selectedLogIds={[]} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: /2 logs/i }));

    expect(onSelect).toHaveBeenCalledWith(['one', 'two']);
    expect(setIsPlaying).toHaveBeenCalledWith(false);
    expect(setPlayheadTimeS).toHaveBeenCalledWith(10.25);
    expect(setPlayheadLineTimeMs).toHaveBeenCalledWith(10_250);
  });

  it('keeps chart interactions enabled outside marker hit targets', () => {
    render(<ResourceLogMarkers logs={logs} selectedLogIds={[]} onSelect={vi.fn()} />);

    expect(screen.getByTestId('resource-log-marker-overlay')).toHaveClass('pointer-events-none');
    for (const button of screen.getAllByRole('button')) {
      expect(button).toHaveClass('pointer-events-auto');
    }
  });
});
