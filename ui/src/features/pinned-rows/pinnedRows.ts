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

const PATH_SEPARATOR = ' › ';

/**
 * Describe where each row lives, so a pinned row still says what it belongs to.
 *
 * Each row maps to the names of its ancestors, joined with "›". Rows that belong to another
 * row rather than to their tree parent (a lane drawn next to its resource) name that row via
 * `getParentId`, and the owner's own name is included in the path.
 */
export function buildPinnedPathLabels<T extends TreeNode<T>>(
  roots: readonly T[],
  getName: (row: T) => string | undefined,
  getParentId: (row: T) => string | undefined
): Map<string, string> {
  // Names from the top of the tree down to and including each row.
  const namePaths = new Map<string, string[]>();
  const ancestorNames = new Map<string, string[]>();
  const parentIds = new Map<string, string | undefined>();

  const visit = (row: T, ancestors: string[]) => {
    const name = getName(row);
    const ownPath = name ? [...ancestors, name] : ancestors;
    ancestorNames.set(row.id, ancestors);
    namePaths.set(row.id, ownPath);
    parentIds.set(row.id, getParentId(row));
    for (const child of row.children ?? []) {
      visit(child, ownPath);
    }
  };
  for (const root of roots) {
    visit(root, []);
  }

  const labels = new Map<string, string>();
  for (const [id, ancestors] of ancestorNames) {
    const parentId = parentIds.get(id);
    const owner = parentId === undefined ? undefined : namePaths.get(parentId);
    labels.set(id, (owner ?? ancestors).join(PATH_SEPARATOR));
  }
  return labels;
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
