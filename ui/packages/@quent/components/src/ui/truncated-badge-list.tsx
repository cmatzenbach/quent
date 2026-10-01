// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Fragment, useLayoutEffect, useRef, useState, type Key, type ReactNode } from 'react';
import { cn } from '@quent/utils';
import { Badge } from './badge';

export interface TruncatedBadgeListProps<T> {
  items: readonly T[];
  /** Upper bound on visible badges. */
  maxVisible: number;
  getItemKey: (item: T) => Key;
  getItemLabel: (item: T) => string;
  renderBadge: (item: T) => ReactNode;
  renderOverflowLabel?: (hiddenCount: number) => ReactNode;
  /** Rendered inline after the last badge (and the overflow badge). */
  trailing?: ReactNode;
  /**
   * Keep everything on one line: show only as many badges as fit the container width
   * (up to `maxVisible`) and fold the rest into the overflow badge.
   */
  fitToWidth?: boolean;
  className?: string;
  overflowBadgeClassName?: string;
}

interface Measurements {
  /** Identifies the item list these widths belong to. */
  key: string;
  itemWidths: number[];
  overflowWidth: number;
  trailingWidth: number;
  fitCount: number;
}

interface FitInput {
  itemWidths: readonly number[];
  overflowWidth: number;
  trailingWidth: number;
  hasTrailing: boolean;
  available: number;
  gap: number;
  maxVisible: number;
}

/** How many leading badges fit next to the overflow badge and trailing content. */
function countBadgesThatFit({
  itemWidths,
  overflowWidth,
  trailingWidth,
  hasTrailing,
  available,
  gap,
  maxVisible,
}: FitInput): number {
  const total = itemWidths.length;
  const limit = Math.min(Math.max(0, maxVisible), total);
  for (let count = limit; count > 0; count -= 1) {
    const hasOverflow = count < total;
    const pieces = count + (hasOverflow ? 1 : 0) + (hasTrailing ? 1 : 0);
    const used =
      itemWidths.slice(0, count).reduce((sum, width) => sum + width, 0) +
      (hasOverflow ? overflowWidth : 0) +
      (hasTrailing ? trailingWidth : 0) +
      (pieces - 1) * gap;
    if (used <= available) {
      return count;
    }
  }
  // Always show one badge; it truncates its own label when even that is too wide.
  return Math.min(1, limit);
}

function readWidth(container: HTMLElement, selector: string): number {
  return container.querySelector<HTMLElement>(selector)?.offsetWidth ?? 0;
}

function readGap(container: HTMLElement): number {
  const gap = parseFloat(getComputedStyle(container).columnGap);
  return Number.isNaN(gap) ? 0 : gap;
}

export function TruncatedBadgeList<T>({
  items,
  maxVisible,
  getItemKey,
  getItemLabel,
  renderBadge,
  renderOverflowLabel = hiddenCount => `+${hiddenCount} more`,
  trailing,
  fitToWidth = false,
  className,
  overflowBadgeClassName,
}: TruncatedBadgeListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measurements, setMeasurements] = useState<Measurements | null>(null);
  const itemsKey = items.map(getItemKey).join('\0');
  const hasTrailing = trailing != null;

  // Until the current items have been measured, render all of them once so their
  // natural widths can be read before the browser paints.
  const isMeasuring = fitToWidth && measurements?.key !== itemsKey;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!fitToWidth || !isMeasuring || !container) {
      return;
    }
    const itemWidths = Array.from(container.querySelectorAll<HTMLElement>('[data-fit-item]')).map(
      element => element.offsetWidth
    );
    const overflowWidth = readWidth(container, '[data-fit-overflow]');
    const trailingWidth = readWidth(container, '[data-fit-trailing]');
    setMeasurements({
      key: itemsKey,
      itemWidths,
      overflowWidth,
      trailingWidth,
      fitCount: countBadgesThatFit({
        itemWidths,
        overflowWidth,
        trailingWidth,
        hasTrailing,
        available: container.clientWidth,
        gap: readGap(container),
        maxVisible,
      }),
    });
  }, [fitToWidth, isMeasuring, itemsKey, hasTrailing, maxVisible]);

  // Re-fit with the stored widths whenever the container is resized.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!fitToWidth || !container || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      setMeasurements(current => {
        if (!current) {
          return current;
        }
        const fitCount = countBadgesThatFit({
          ...current,
          hasTrailing,
          available: container.clientWidth,
          gap: readGap(container),
          maxVisible,
        });
        return fitCount === current.fitCount ? current : { ...current, fitCount };
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitToWidth, hasTrailing, maxVisible]);

  const visibleCount = isMeasuring
    ? items.length
    : fitToWidth && measurements
      ? Math.min(measurements.fitCount, maxVisible)
      : Math.max(0, maxVisible);
  const visibleItems = items.slice(0, visibleCount);
  const hiddenItems = items.slice(visibleItems.length);

  const overflowBadge = (hiddenCount: number, title: string) => (
    <Badge
      variant="outline"
      className={cn('shrink-0 bg-muted/40 text-muted-foreground', overflowBadgeClassName)}
      title={title}
    >
      {renderOverflowLabel(hiddenCount)}
    </Badge>
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center gap-1',
        fitToWidth ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
        className
      )}
    >
      {visibleItems.map(item =>
        fitToWidth ? (
          <span key={getItemKey(item)} data-fit-item className="flex min-w-0 max-w-full shrink-0">
            {renderBadge(item)}
          </span>
        ) : (
          <Fragment key={getItemKey(item)}>{renderBadge(item)}</Fragment>
        )
      )}
      {hiddenItems.length > 0 &&
        (fitToWidth ? (
          <span data-fit-overflow className="flex shrink-0">
            {overflowBadge(hiddenItems.length, hiddenItems.map(getItemLabel).join(', '))}
          </span>
        ) : (
          overflowBadge(hiddenItems.length, hiddenItems.map(getItemLabel).join(', '))
        ))}
      {isMeasuring && items.length > 0 && (
        // Measuring pass only: a worst-case overflow badge so its width is known.
        <span data-fit-overflow className="flex shrink-0">
          {overflowBadge(items.length, '')}
        </span>
      )}
      {hasTrailing &&
        (fitToWidth ? (
          <span data-fit-trailing className="flex shrink-0 items-center">
            {trailing}
          </span>
        ) : (
          trailing
        ))}
    </div>
  );
}
