/**
 * Tree Builder
 *
 * Converts linear ConversationMessage[] into a branch-preserving ConversationTree.
 * Handles tree node ID generation (content-hash based), linear→tree conversion,
 * and merging multiple sync snapshots to accumulate branches.
 */

import { generateHash } from './hash';
import type { ConversationData, ConversationTree, TreeNode } from './types';

/**
 * Generate a unique tree node ID from role, index, and content hash.
 * Format: `${role}-${index}-${hash8}`
 *
 * Same content at the same position always produces the same ID.
 * Different content at the same position produces different IDs,
 * enabling branch detection during merge.
 */
export function generateTreeNodeId(
  role: 'user' | 'assistant',
  index: number,
  content: string
): string {
  const hash8 = generateHash(content);
  return `${role}-${index}-${hash8}`;
}

/**
 * Build a ConversationTree from a linear ConversationData.
 *
 * Each message becomes a TreeNode with a content-hash-based ID.
 * Messages are linked linearly: each node's parent is the previous node.
 * The activePath records the current message chain.
 */
export function buildConversationTree(data: ConversationData): ConversationTree {
  const tree: Record<string, TreeNode> = {};
  const activePath: string[] = [];

  for (let i = 0; i < data.messages.length; i++) {
    const msg = data.messages[i];
    const nodeId = generateTreeNodeId(msg.role, i, msg.content);
    const parentId = i > 0 ? activePath[i - 1] : null;

    const node: TreeNode = {
      id: nodeId,
      role: msg.role,
      content: msg.content,
      parent: parentId,
      children: [],
    };

    if (msg.toolContent) {
      node.toolContent = msg.toolContent;
    }

    tree[nodeId] = node;
    activePath.push(nodeId);

    // Link parent → child
    if (parentId && tree[parentId]) {
      tree[parentId].children.push(nodeId);
    }
  }

  const now = data.extractedAt.toISOString();

  return {
    id: data.id,
    title: data.title,
    source: data.source,
    url: data.url,
    created: now,
    modified: now,
    activePath,
    tree,
  };
}

/**
 * Merge an incoming tree into an existing tree, accumulating branches.
 *
 * Strategy:
 * 1. Keep all existing nodes
 * 2. For each incoming node:
 *    - If same ID exists in existing → skip (same content at same position)
 *    - If new ID → add node, update parent's children array
 * 3. Update activePath to incoming (latest view)
 * 4. Preserve earliest created, update modified to latest
 */
export function mergeTree(existing: ConversationTree, incoming: ConversationTree): ConversationTree {
  // Deep clone existing tree to avoid mutation
  const merged: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(existing.tree)) {
    merged[id] = { ...node, children: [...node.children] };
  }

  // Add new nodes from incoming
  for (const [id, incomingNode] of Object.entries(incoming.tree)) {
    if (merged[id]) {
      // Node already exists (same content at same position) — skip
      continue;
    }

    // New node — add it
    merged[id] = { ...incomingNode, children: [...incomingNode.children] };

    // Update parent's children array if parent exists in merged tree
    if (incomingNode.parent && merged[incomingNode.parent]) {
      const parentChildren = merged[incomingNode.parent].children;
      if (!parentChildren.includes(id)) {
        parentChildren.push(id);
      }
    }
  }

  // Ensure incoming node children are also present in merged
  // (handles case where incoming has children links to nodes we just added)
  for (const [id, incomingNode] of Object.entries(incoming.tree)) {
    if (!merged[id]) continue;
    for (const childId of incomingNode.children) {
      if (merged[childId] && !merged[id].children.includes(childId)) {
        merged[id].children.push(childId);
      }
    }
  }

  return {
    id: incoming.id,
    title: incoming.title,
    source: incoming.source,
    url: incoming.url,
    created: existing.created < incoming.created ? existing.created : incoming.created,
    modified: existing.modified > incoming.modified ? existing.modified : incoming.modified,
    activePath: incoming.activePath,
    tree: merged,
  };
}

/**
 * Serialize a ConversationTree to a JSON string with 2-space indentation.
 */
export function serializeTree(tree: ConversationTree): string {
  return JSON.stringify(tree, null, 2);
}
