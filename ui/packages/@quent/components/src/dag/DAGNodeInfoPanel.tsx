// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from 'react';
import { Panel } from '@xyflow/react';
import { Pin, ChevronUp, ChevronDown } from 'lucide-react';
import { useSelectedNodeData } from '@quent/hooks';
import { DataText } from '../ui/data-text';
import { thinScrollbarClass } from '../ui/thin-scroll';
import { inferFieldFormatter } from '../services/query-plan/dagFieldProcessing';

export const DAGNodeInfoPanel = () => {
  const selectedNodeData = useSelectedNodeData();
  const [isMinimized, setIsMinimized] = useState(true);

  useEffect(() => {
    if (!selectedNodeData) {
      setIsMinimized(true);
    }
  }, [selectedNodeData]);

  return (
    <Panel
      position="bottom-left"
      className="nodrag nopan mb-2 ml-2"
    >
      <div className="w-72 rounded-md border bg-popover px-4 py-2 text-popover-foreground shadow-md">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">Operator Details</span>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            disabled={!selectedNodeData}
            className="rounded p-1 hover:bg-muted transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-auto disabled:hover:bg-transparent"
            aria-label="Toggle panel"
          >
            {isMinimized ? (
              <ChevronUp className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        </div>
        {!isMinimized && (
          <>
            <div className="flex items-center justify-between gap-2 mt-2">
              <DataText className="font-semibold text-sm truncate">
                {selectedNodeData?.label}
              </DataText>
              <div className="flex items-center gap-1 flex-shrink-0">
                <DataText className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 bg-muted rounded">
                  {selectedNodeData?.operationType}
                </DataText>
              </div>
            </div>
            <DataText as="div" className="text-xs text-muted-foreground truncate mt-0.5">
              {selectedNodeData?.nodeId}
            </DataText>
            {(selectedNodeData?.statistics?.length ?? 0) > 0 && (
              <div
                className={`mt-1 border-t pt-1.5 max-h-56 overflow-y-auto ${thinScrollbarClass}`}
              >
                <div className="flex flex-col gap-1 pr-3">
                  {selectedNodeData?.statistics.map(({ key, value }) => (
                    <div key={key} className="text-xs mt-1">
                      {Array.isArray(value) ? (
                        <div className="flex items-center justify-between gap-0.5">
                          <DataText className="capitalize">{key.replace(/_/g, ' ')}:</DataText>
                          <div className="ml-2 flex flex-col gap-0.5">
                            {value.map((item, i) => (
                              <DataText
                                key={i}
                                className="text-muted-foreground whitespace-pre-line"
                              >
                                {item}
                              </DataText>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <DataText className="capitalize">{key.replace(/_/g, ' ')}:</DataText>
                          <DataText className="text-muted-foreground ml-1">
                            {typeof value === 'number'
                              ? inferFieldFormatter(key)(value)
                              : String(value)}
                          </DataText>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
};
