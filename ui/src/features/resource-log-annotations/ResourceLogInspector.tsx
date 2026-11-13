// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { X } from 'lucide-react';
import {
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerPortal,
  DrawerTitle,
  ScrollArea,
} from '@quent/components';
import { cn, formatDuration } from '@quent/utils';
import type { ResourceLogEntry, ResourceLogSeverity } from './logAnnotations';

interface ResourceLogInspectorProps {
  logs: readonly ResourceLogEntry[] | null;
  resourceLabel: string;
  onClose: () => void;
}

const severityClasses: Record<ResourceLogSeverity, string> = {
  info: 'bg-sky-500',
  warning: 'bg-amber-500 dark:bg-amber-400',
  error: 'bg-destructive',
};

export function ResourceLogInspector({ logs, resourceLabel, onClose }: ResourceLogInspectorProps) {
  return (
    <Drawer
      open={logs !== null}
      onOpenChange={open => {
        if (!open) {
          onClose();
        }
      }}
      direction="right"
      modal={false}
      noBodyStyles
      shouldScaleBackground={false}
      handleOnly
    >
      <DrawerPortal>
        <DrawerContent
          onPointerDownOutside={event => {
            const target = event.detail.originalEvent.target;
            if (target instanceof Element && target.closest('[data-log-marker]')) {
              return;
            }
            onClose();
          }}
          className="h-full w-96 shadow-xl sm:max-w-none"
        >
          <div className="flex shrink-0 items-center justify-between border-b bg-card px-3 py-2">
            <div className="min-w-0">
              <DrawerTitle className="text-sm">Log details</DrawerTitle>
              <DrawerDescription className="truncate text-xs">{resourceLabel}</DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" aria-label="Close log details">
                <X className="size-4" />
              </Button>
            </DrawerClose>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <ol aria-label="Log entries" className="divide-y">
              {logs?.map(log => (
                <li key={log.id} className="space-y-1.5 px-4 py-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className={cn('size-2 shrink-0 rounded-full', severityClasses[log.severity])}
                    />
                    <span className="font-medium uppercase">{log.severity}</span>
                    <span className="text-muted-foreground">{log.source}</span>
                    <time className="ml-auto font-mono text-muted-foreground">
                      {formatDuration(log.timestampSeconds * 1000)}
                    </time>
                  </div>
                  <p className="text-foreground">{log.message}</p>
                </li>
              ))}
            </ol>
          </ScrollArea>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
