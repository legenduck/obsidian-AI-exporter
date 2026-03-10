/**
 * Tree to Indent Markdown Converter
 *
 * Converts a ConversationTree into an indented markdown format optimized for
 * LLM consumption. Branches are labeled [A], [B], etc. with increasing
 * indentation. Nested branches get compound labels like [B-1], [B-2].
 *
 * Token overhead: ~4% vs raw text (60% savings compared to JSON)
 */

import type { ConversationTree, TreeNode } from './types';

const ROLE_PREFIX: Record<string, string> = {
  user: 'U',
  assistant: 'A',
};

const BRANCH_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Convert a ConversationTree to indented markdown string.
 */
export function treeToIndentMarkdown(tree: ConversationTree): string {
  const roots = findRootNodes(tree);
  if (roots.length === 0) return '';

  const lines: string[] = [];

  for (const root of roots) {
    traverse(tree, root, 0, null, null, lines);
  }

  return lines.join('\n');
}

function findRootNodes(tree: ConversationTree): TreeNode[] {
  return Object.values(tree.tree).filter((n) => n.parent === null);
}

/**
 * Unified traversal function.
 *
 * @param tree - Full conversation tree
 * @param node - Current node
 * @param indent - Current indentation (spaces)
 * @param branchLabel - Label for THIS node (e.g., "[A]"), or null
 * @param branchContext - Enclosing branch context for nested label generation (e.g., "[B]")
 * @param lines - Output accumulator
 */
function traverse(
  tree: ConversationTree,
  node: TreeNode,
  indent: number,
  branchLabel: string | null,
  branchContext: string | null,
  lines: string[]
): void {
  const prefix = ROLE_PREFIX[node.role] || node.role;
  const labelStr = branchLabel ? `${branchLabel} ` : '';
  const indentStr = ' '.repeat(indent);

  // Render this node
  const contentLines = node.content.split('\n');
  lines.push(`${indentStr}${labelStr}${prefix}: ${contentLines[0]}`);

  if (contentLines.length > 1) {
    const contentStart = indent + labelStr.length + prefix.length + 2;
    const continuationIndent = ' '.repeat(contentStart);
    for (let i = 1; i < contentLines.length; i++) {
      lines.push(`${continuationIndent}${contentLines[i]}`);
    }
  }

  // Process children
  const children = node.children
    .map((id) => tree.tree[id])
    .filter((n): n is TreeNode => n != null);

  if (children.length === 0) {
    return;
  }

  // Determine child indent: if this node had a branch label, children align after the label
  const childIndent = branchLabel ? indent + labelStr.length : indent;
  // Current branch context for children: if this node had a label, it becomes the context
  const currentContext = branchLabel ?? branchContext;

  if (children.length === 1) {
    // Single child — continue at aligned indent, no label, inherit branch context
    traverse(tree, children[0], childIndent, null, currentContext, lines);
  } else {
    // Multiple children — create branch labels with offset indent
    const branchIndent = childIndent + 2;
    for (let i = 0; i < children.length; i++) {
      const label = buildBranchLabel(currentContext, i);
      traverse(tree, children[i], branchIndent, label, currentContext, lines);
    }
  }
}

/**
 * Build a branch label like [A], [B], or nested like [B-1], [B-2].
 *
 * @param parentContext - Enclosing branch label (e.g., "[B]"), or null for top-level
 * @param index - 0-based index among siblings
 */
function buildBranchLabel(parentContext: string | null, index: number): string {
  if (!parentContext) {
    return `[${BRANCH_LABELS[index] || index}]`;
  }
  const parentContent = parentContext.slice(1, -1);
  return `[${parentContent}-${index + 1}]`;
}
