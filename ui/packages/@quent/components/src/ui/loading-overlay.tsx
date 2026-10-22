// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { LoaderCircle } from 'lucide-react';
import { cn } from '@quent/utils';

export interface LoadingOverlayProps {
  label?: string;
  className?: string;
}

/**
 * Dims the nearest positioned (`relative`) parent and shows a centered status pill.
 * Clicks pass through to the content underneath.
 */
export function LoadingOverlay({ label = 'Updating…', className }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/70 backdrop-blur-[1px]',
        className
      )}
    >
      <span
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-lg"
      >
        <LoaderCircle className="size-4 animate-spin text-primary" />
        {label}
      </span>
    </div>
  );
}
