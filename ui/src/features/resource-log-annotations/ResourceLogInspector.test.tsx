// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ResourceLogEntry } from './logAnnotations';
import { ResourceLogInspector } from './ResourceLogInspector';

const logs: ResourceLogEntry[] = [
  {
    id: 'one',
    resourceId: 'resource-1',
    timestampSeconds: 10,
    severity: 'warning',
    source: 'scheduler',
    message: 'Queue depth is high.',
  },
  {
    id: 'two',
    resourceId: 'resource-1',
    timestampSeconds: 10.5,
    severity: 'error',
    source: 'runtime',
    message: 'Operation failed.',
  },
];

describe('ResourceLogInspector', () => {
  it('renders selected logs in a viewport-fixed drawer', () => {
    render(<ResourceLogInspector logs={logs} resourceLabel="GPU 0 (GPU)" onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Log details' })).toHaveClass('fixed');
    expect(screen.getByText('GPU 0 (GPU)')).toBeInTheDocument();
    expect(screen.getByText('Queue depth is high.')).toBeInTheDocument();
    expect(screen.getByText('Operation failed.')).toBeInTheDocument();
    expect(screen.getByText('10.00s')).toBeInTheDocument();
    expect(screen.getByText('10.50s')).toBeInTheDocument();
  });

  it('closes from its close button', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ResourceLogInspector logs={logs} resourceLabel="GPU 0 (GPU)" onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Close log details' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not render without a selection', () => {
    render(<ResourceLogInspector logs={null} resourceLabel="" onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog', { name: 'Log details' })).not.toBeInTheDocument();
  });
});
