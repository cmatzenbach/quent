// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// Most rows a user can pin. Keeps shared links and the pinned section a sane size.
export const MAX_PINNED_ROWS = 20;

interface TreeNode<T> {
  id: string;
  children?: readonly T[];
}

// Visit every row in tree order (parents before children), whether or not it is expanded.
function walkRows<T extends TreeNode<T>>(roots: readonly T[], visit: (row: T) => void) {
  for (const row of roots) {
    visit(row);
    if (row.children) {
      walkRows(row.children, visit);
    }
  }
}

export interface PinnedRowsResult<T> {
  // Pinned rows that are in the displayed tree, in tree order.
  shownItems: T[];
  // Pinned rows that exist but a filter has removed from the displayed tree.
  hiddenCount: number;
}

/**
 * Work out which pinned rows to show.
 *
 * `fullRoots` is the whole tree, `displayedRoots` is the tree after filtering. Pins stay
 * stored even when a filter hides them, so clearing the filter brings them back. Ids that
 * are not in the full tree at all (for example, from an old shared link) are ignored.
 */
export function resolvePinnedRows<T extends TreeNode<T>>(
  pinnedIds: ReadonlySet<string>,
  fullRoots: readonly T[],
  displayedRoots: readonly T[]
): PinnedRowsResult<T> {
  if (pinnedIds.size === 0) {
    return { shownItems: [], hiddenCount: 0 };
  }

  const shownItems: T[] = [];
  const shownIds = new Set<string>();
  walkRows(displayedRoots, row => {
    if (pinnedIds.has(row.id) && !shownIds.has(row.id)) {
      shownIds.add(row.id);
      shownItems.push(row);
    }
  });

  let hiddenCount = 0;
  const countedIds = new Set<string>();
  walkRows(fullRoots, row => {
    if (pinnedIds.has(row.id) && !shownIds.has(row.id) && !countedIds.has(row.id)) {
      countedIds.add(row.id);
      hiddenCount += 1;
    }
  });

  return { shownItems, hiddenCount };
}

/**
 * Ids of the rows above `id`, from the top of the tree down to its direct parent, or undefined
 * when the row is not in the tree. Used to expand the path to a row before scrolling to it.
 */
export function findAncestorIds<T extends TreeNode<T>>(
  roots: readonly T[],
  id: string
): string[] | undefined {
  for (const root of roots) {
    const path = pathTo(root, id, []);
    if (path) {
      return path;
    }
  }
  return undefined;
}

function pathTo<T extends TreeNode<T>>(
  row: T,
  id: string,
  ancestors: string[]
): string[] | undefined {
  if (row.id === id) {
    return ancestors;
  }
  for (const child of row.children ?? []) {
    const path = pathTo(child, id, [...ancestors, row.id]);
    if (path) {
      return path;
    }
  }
  return undefined;
}

/**
 * Name the worker each row belongs to, so pinned rows that share a name across workers can be
 * told apart. A row maps to the nearest worker above it; a worker row has no label of its own.
 * Rows that belong to another row rather than their tree parent (a lane drawn next to its
 * resource) use that row's worker, counting that row itself if it is a worker. Rows with no
 * worker above them are left out.
 */
export function buildPinnedWorkerLabels<T extends TreeNode<T>>(
  roots: readonly T[],
  getWorkerName: (row: T) => string | undefined,
  getParentId: (row: T) => string | undefined
): Map<string, string> {
  // The nearest worker above each row, and the nearest worker at or above it.
  const workerAbove = new Map<string, string | undefined>();
  const workerAtOrAbove = new Map<string, string | undefined>();
  const parentIds = new Map<string, string | undefined>();

  const visit = (row: T, above: string | undefined) => {
    const atOrAbove = getWorkerName(row) ?? above;
    workerAbove.set(row.id, above);
    workerAtOrAbove.set(row.id, atOrAbove);
    parentIds.set(row.id, getParentId(row));
    for (const child of row.children ?? []) {
      visit(child, atOrAbove);
    }
  };
  for (const root of roots) {
    visit(root, undefined);
  }

  const labels = new Map<string, string>();
  for (const [id, above] of workerAbove) {
    const parentId = parentIds.get(id);
    const worker =
      parentId !== undefined && workerAtOrAbove.has(parentId)
        ? workerAtOrAbove.get(parentId)
        : above;
    if (worker !== undefined) {
      labels.set(id, worker);
    }
  }
  return labels;
}
