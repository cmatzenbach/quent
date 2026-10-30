// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@quent/components';

// The pinned panel opens tall enough for this many rows. The user can drag it to show more.
const INITIAL_VISIBLE_PINNED_ROWS = 6;
// Used for the first paint, before the real height is measured.
const FALLBACK_PANEL_HEIGHT = 240;
const FALLBACK_MIN_HEIGHT = 64;

// Keeps the space for a scrollbar on both tables, so their columns line up whether or not
// either one is currently scrolling.
const STABLE_GUTTER = '[&>div>div>div]:[scrollbar-gutter:stable]';

// A new panel can't be resized until the group has measured it, and resizing sooner throws.
// Try again each frame until that has happened. Returns a function that stops trying.
const MAX_LAYOUT_ATTEMPTS = 30;
function whenPanelReady(apply: () => void): () => void {
  let frame = 0;
  let attempts = 0;
  const attempt = () => {
    try {
      apply();
    } catch (error) {
      attempts += 1;
      if (attempts >= MAX_LAYOUT_ATTEMPTS) {
        throw error;
      }
      frame = requestAnimationFrame(attempt);
    }
  };
  frame = requestAnimationFrame(attempt);
  return () => cancelAnimationFrame(frame);
}

interface PinnedRowsSplitProps {
  // The pinned rows table. Leave out when nothing is pinned.
  pinned?: ReactNode;
  pinnedCount: number;
  isCollapsed: boolean;
  children: ReactNode;
}

function contentHeight(panelContent: HTMLElement | null): number | undefined {
  const scroller = panelContent?.querySelector<HTMLElement>('.overflow-auto');
  return (scroller?.firstElementChild as HTMLElement | null)?.offsetHeight;
}

function pinnedRowHeights(panelContent: HTMLElement | null): number[] {
  return Array.from(panelContent?.querySelectorAll<HTMLElement>('[role="listitem"]') ?? []).map(
    row => row.offsetHeight
  );
}

/**
 * Shows the pinned rows in a panel above the main table, with a handle between them to
 * resize it. Each panel scrolls on its own.
 */
export function PinnedRowsSplit({
  pinned,
  pinnedCount,
  isCollapsed,
  children,
}: PinnedRowsSplitProps) {
  const panelRef = useRef<PanelImperativeHandle | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const openHeightRef = useRef<number | undefined>(undefined);
  // Set once the user resizes the panel themselves; after that, pinning leaves its height alone.
  const userSizedRef = useRef(false);
  const hasPinned = pinned != null;

  // The panel grows with each pinned row, up to the limit, until the user sizes it themselves.
  useLayoutEffect(() => {
    if (!hasPinned) {
      openHeightRef.current = undefined;
      userSizedRef.current = false;
      return;
    }
    if (userSizedRef.current) {
      return;
    }
    const total = contentHeight(contentRef.current);
    if (total === undefined || total === 0) {
      return;
    }
    const rowHeights = pinnedRowHeights(contentRef.current);
    const sum = (heights: number[]) => heights.reduce((acc, height) => acc + height, 0);
    const chrome = Math.max(total - sum(rowHeights), 0);
    const shownRows = sum(rowHeights.slice(0, INITIAL_VISIBLE_PINNED_ROWS));
    const initial = chrome + shownRows;
    openHeightRef.current = initial;
    return whenPanelReady(() => panelRef.current?.resize(isCollapsed ? total : initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPinned, pinnedCount]);

  // Collapsing shrinks the panel to its header; opening restores the height it had.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!hasPinned || !panel) {
      return;
    }
    if (isCollapsed) {
      return whenPanelReady(() => {
        openHeightRef.current = panel.getSize().inPixels;
        const collapsed = contentHeight(contentRef.current);
        if (collapsed) {
          panel.resize(collapsed);
        }
      });
    }
    const openHeight = openHeightRef.current;
    return openHeight ? whenPanelReady(() => panel.resize(openHeight)) : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollapsed]);

  const markUserSized = () => {
    userSizedRef.current = true;
  };

  return (
    <ResizablePanelGroup orientation="vertical" className="h-full">
      {hasPinned && (
        <ResizablePanel
          key="pinned"
          id="pinned-rows"
          panelRef={panelRef}
          defaultSize={FALLBACK_PANEL_HEIGHT}
          minSize={FALLBACK_MIN_HEIGHT}
          groupResizeBehavior="preserve-pixel-size"
          className="min-h-0"
        >
          <div ref={contentRef} className={`h-full ${STABLE_GUTTER}`}>
            {pinned}
          </div>
        </ResizablePanel>
      )}
      {hasPinned && (
        <ResizableHandle
          key="pinned-handle"
          withHandle
          disabled={isCollapsed}
          onPointerDown={markUserSized}
          onKeyDown={markUserSized}
        />
      )}
      <ResizablePanel key="main" id="timeline-tree" minSize="10%" className="min-h-0">
        <div className={`h-full ${STABLE_GUTTER} ${hasPinned ? 'pt-4' : ''}`}>{children}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
