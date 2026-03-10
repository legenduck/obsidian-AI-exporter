import { describe, it, expect } from 'vitest';
import { treeToIndentMarkdown } from '../../src/lib/tree-to-markdown';
import type { ConversationTree, TreeNode } from '../../src/lib/types';

function makeTree(nodes: Record<string, TreeNode>, activePath: string[]): ConversationTree {
  return {
    id: 'test-conv',
    title: 'Test',
    source: 'claude',
    url: 'https://claude.ai/chat/test',
    created: '2026-03-03T10:00:00.000Z',
    modified: '2026-03-03T10:00:00.000Z',
    activePath,
    tree: nodes,
  };
}

function node(
  id: string,
  role: 'user' | 'assistant',
  content: string,
  parent: string | null,
  children: string[]
): TreeNode {
  return { id, role, content, parent, children };
}

describe('treeToIndentMarkdown', () => {
  it('converts a linear conversation (no branches)', () => {
    const tree = makeTree(
      {
        u0: node('u0', 'user', 'Hello', null, ['a1']),
        a1: node('a1', 'assistant', 'Hi there', 'u0', []),
      },
      ['u0', 'a1']
    );

    const md = treeToIndentMarkdown(tree);
    expect(md).toBe('U: Hello\nA: Hi there');
  });

  it('handles empty tree', () => {
    const tree = makeTree({}, []);
    const md = treeToIndentMarkdown(tree);
    expect(md).toBe('');
  });

  it('handles single message', () => {
    const tree = makeTree(
      {
        u0: node('u0', 'user', 'Just a question', null, []),
      },
      ['u0']
    );

    const md = treeToIndentMarkdown(tree);
    expect(md).toBe('U: Just a question');
  });

  it('adds branch labels when a node has multiple children', () => {
    const tree = makeTree(
      {
        u0: node('u0', 'user', 'Question', null, ['a1']),
        a1: node('a1', 'assistant', 'Answer', 'u0', ['u2a', 'u2b']),
        u2a: node('u2a', 'user', 'Follow-up A', 'a1', ['a3a']),
        a3a: node('a3a', 'assistant', 'Response A', 'u2a', []),
        u2b: node('u2b', 'user', 'Follow-up B', 'a1', ['a3b']),
        a3b: node('a3b', 'assistant', 'Response B', 'u2b', []),
      },
      ['u0', 'a1', 'u2b', 'a3b']
    );

    const md = treeToIndentMarkdown(tree);
    const lines = md.split('\n');

    expect(lines[0]).toBe('U: Question');
    expect(lines[1]).toBe('A: Answer');
    expect(lines[2]).toBe('  [A] U: Follow-up A');
    expect(lines[3]).toBe('      A: Response A');
    expect(lines[4]).toBe('  [B] U: Follow-up B');
    expect(lines[5]).toBe('      A: Response B');
  });

  it('handles nested branching (branch within a branch)', () => {
    const tree = makeTree(
      {
        u0: node('u0', 'user', 'Q', null, ['a1']),
        a1: node('a1', 'assistant', 'A', 'u0', ['u2a', 'u2b']),
        u2a: node('u2a', 'user', 'Branch A', 'a1', ['a3a']),
        a3a: node('a3a', 'assistant', 'Resp A', 'u2a', []),
        u2b: node('u2b', 'user', 'Branch B', 'a1', ['a3b']),
        a3b: node('a3b', 'assistant', 'Resp B', 'u2b', ['u4b1', 'u4b2']),
        u4b1: node('u4b1', 'user', 'B sub-1', 'a3b', ['a5b1']),
        a5b1: node('a5b1', 'assistant', 'Resp B-1', 'u4b1', []),
        u4b2: node('u4b2', 'user', 'B sub-2', 'a3b', ['a5b2']),
        a5b2: node('a5b2', 'assistant', 'Resp B-2', 'u4b2', []),
      },
      ['u0', 'a1', 'u2b', 'a3b', 'u4b2', 'a5b2']
    );

    const md = treeToIndentMarkdown(tree);
    const lines = md.split('\n');

    expect(lines[0]).toBe('U: Q');
    expect(lines[1]).toBe('A: A');
    expect(lines[2]).toBe('  [A] U: Branch A');
    expect(lines[3]).toBe('      A: Resp A');
    expect(lines[4]).toBe('  [B] U: Branch B');
    expect(lines[5]).toBe('      A: Resp B');
    expect(lines[6]).toBe('        [B-1] U: B sub-1');
    expect(lines[7]).toBe('              A: Resp B-1');
    expect(lines[8]).toBe('        [B-2] U: B sub-2');
    expect(lines[9]).toBe('              A: Resp B-2');
  });

  it('handles three-way branching', () => {
    const tree = makeTree(
      {
        u0: node('u0', 'user', 'Q', null, ['a1a', 'a1b', 'a1c']),
        a1a: node('a1a', 'assistant', 'Ans A', 'u0', []),
        a1b: node('a1b', 'assistant', 'Ans B', 'u0', []),
        a1c: node('a1c', 'assistant', 'Ans C', 'u0', []),
      },
      ['u0', 'a1c']
    );

    const md = treeToIndentMarkdown(tree);
    const lines = md.split('\n');

    expect(lines[0]).toBe('U: Q');
    expect(lines[1]).toBe('  [A] A: Ans A');
    expect(lines[2]).toBe('  [B] A: Ans B');
    expect(lines[3]).toBe('  [C] A: Ans C');
  });

  it('preserves multiline content with proper indentation', () => {
    const tree = makeTree(
      {
        u0: node('u0', 'user', 'Line 1\nLine 2\nLine 3', null, ['a1']),
        a1: node('a1', 'assistant', 'Response line 1\nResponse line 2', 'u0', []),
      },
      ['u0', 'a1']
    );

    const md = treeToIndentMarkdown(tree);
    const lines = md.split('\n');

    expect(lines[0]).toBe('U: Line 1');
    expect(lines[1]).toBe('   Line 2');
    expect(lines[2]).toBe('   Line 3');
    expect(lines[3]).toBe('A: Response line 1');
    expect(lines[4]).toBe('   Response line 2');
  });
});
