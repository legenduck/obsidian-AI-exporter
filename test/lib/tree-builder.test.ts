import { describe, it, expect } from 'vitest';
import {
  buildConversationTree,
  mergeTree,
  serializeTree,
  generateTreeNodeId,
} from '../../src/lib/tree-builder';
import type { ConversationData, ConversationMessage, ConversationTree } from '../../src/lib/types';

function makeMessage(
  index: number,
  role: 'user' | 'assistant',
  content: string
): ConversationMessage {
  return {
    id: `${role}-${index}`,
    role,
    content,
    index,
  };
}

function makeConversationData(messages: ConversationMessage[]): ConversationData {
  return {
    id: 'conv-abc12345',
    title: 'Test Conversation',
    url: 'https://claude.ai/chat/abc12345',
    source: 'claude',
    messages,
    extractedAt: new Date('2026-03-03T10:00:00Z'),
    metadata: {
      messageCount: messages.length,
      userMessageCount: messages.filter((m) => m.role === 'user').length,
      assistantMessageCount: messages.filter((m) => m.role === 'assistant').length,
      hasCodeBlocks: false,
    },
  };
}

describe('tree-builder', () => {
  describe('generateTreeNodeId', () => {
    it('generates ID in role-index-hash8 format', () => {
      const id = generateTreeNodeId('user', 0, 'Hello world');
      expect(id).toMatch(/^user-0-[0-9a-f]{8}$/);
    });

    it('produces different IDs for different content at same index', () => {
      const id1 = generateTreeNodeId('user', 2, 'Branch A content');
      const id2 = generateTreeNodeId('user', 2, 'Branch B content');
      expect(id1).not.toBe(id2);
    });

    it('produces same ID for same content at same index', () => {
      const id1 = generateTreeNodeId('assistant', 1, 'Response text');
      const id2 = generateTreeNodeId('assistant', 1, 'Response text');
      expect(id1).toBe(id2);
    });
  });

  describe('buildConversationTree', () => {
    it('builds tree from linear conversation (2 messages)', () => {
      const messages = [makeMessage(0, 'user', 'Hello'), makeMessage(1, 'assistant', 'Hi there')];
      const data = makeConversationData(messages);
      const tree = buildConversationTree(data);

      expect(tree.id).toBe('conv-abc12345');
      expect(tree.title).toBe('Test Conversation');
      expect(tree.source).toBe('claude');
      expect(tree.url).toBe('https://claude.ai/chat/abc12345');

      const nodeIds = Object.keys(tree.tree);
      expect(nodeIds).toHaveLength(2);

      // First node has no parent
      const firstNode = tree.tree[tree.activePath[0]];
      expect(firstNode.parent).toBeNull();
      expect(firstNode.role).toBe('user');
      expect(firstNode.content).toBe('Hello');

      // Second node has first as parent
      const secondNode = tree.tree[tree.activePath[1]];
      expect(secondNode.parent).toBe(tree.activePath[0]);
      expect(secondNode.role).toBe('assistant');
      expect(secondNode.content).toBe('Hi there');

      // First node has second as child
      expect(firstNode.children).toContain(tree.activePath[1]);
    });

    it('builds tree from empty messages', () => {
      const data = makeConversationData([]);
      const tree = buildConversationTree(data);

      expect(Object.keys(tree.tree)).toHaveLength(0);
      expect(tree.activePath).toHaveLength(0);
    });

    it('preserves toolContent in tree nodes', () => {
      const messages: ConversationMessage[] = [
        makeMessage(0, 'user', 'Search for X'),
        { ...makeMessage(1, 'assistant', 'Here are results'), toolContent: 'Web search: X' },
      ];
      const data = makeConversationData(messages);
      const tree = buildConversationTree(data);

      const assistantNode = tree.tree[tree.activePath[1]];
      expect(assistantNode.toolContent).toBe('Web search: X');
    });

    it('sets activePath in message order', () => {
      const messages = [
        makeMessage(0, 'user', 'Q1'),
        makeMessage(1, 'assistant', 'A1'),
        makeMessage(2, 'user', 'Q2'),
        makeMessage(3, 'assistant', 'A2'),
      ];
      const data = makeConversationData(messages);
      const tree = buildConversationTree(data);

      expect(tree.activePath).toHaveLength(4);
      // Verify chain: each node's parent is the previous node
      for (let i = 1; i < tree.activePath.length; i++) {
        const node = tree.tree[tree.activePath[i]];
        expect(node.parent).toBe(tree.activePath[i - 1]);
      }
    });

    it('sets created and modified timestamps', () => {
      const data = makeConversationData([makeMessage(0, 'user', 'Hi')]);
      const tree = buildConversationTree(data);

      expect(tree.created).toBe('2026-03-03T10:00:00.000Z');
      expect(tree.modified).toBe('2026-03-03T10:00:00.000Z');
    });
  });

  describe('mergeTree', () => {
    it('merges two identical trees without duplicating nodes', () => {
      const messages = [makeMessage(0, 'user', 'Hello'), makeMessage(1, 'assistant', 'Hi')];
      const data = makeConversationData(messages);
      const tree1 = buildConversationTree(data);
      const tree2 = buildConversationTree(data);

      const merged = mergeTree(tree1, tree2);
      expect(Object.keys(merged.tree)).toHaveLength(2);
    });

    it('adds new branch nodes when content differs at same position', () => {
      // Original conversation: Q1 → A1
      const messagesA = [makeMessage(0, 'user', 'Question'), makeMessage(1, 'assistant', 'Answer A')];
      const dataA = makeConversationData(messagesA);
      const treeA = buildConversationTree(dataA);

      // Branch: same Q1 → different A1
      const messagesB = [makeMessage(0, 'user', 'Question'), makeMessage(1, 'assistant', 'Answer B')];
      const dataB = makeConversationData(messagesB);
      const treeB = buildConversationTree(dataB);

      const merged = mergeTree(treeA, treeB);

      // Should have 3 nodes: shared Q1, Answer A, Answer B
      expect(Object.keys(merged.tree)).toHaveLength(3);

      // The shared user node should have 2 children
      const userNodeId = treeA.activePath[0];
      const userNode = merged.tree[userNodeId];
      expect(userNode.children).toHaveLength(2);
    });

    it('extends conversation with new messages', () => {
      // First sync: 2 messages
      const messages1 = [makeMessage(0, 'user', 'Q1'), makeMessage(1, 'assistant', 'A1')];
      const tree1 = buildConversationTree(makeConversationData(messages1));

      // Second sync: 4 messages (conversation continued)
      const messages2 = [
        makeMessage(0, 'user', 'Q1'),
        makeMessage(1, 'assistant', 'A1'),
        makeMessage(2, 'user', 'Q2'),
        makeMessage(3, 'assistant', 'A2'),
      ];
      const tree2 = buildConversationTree(makeConversationData(messages2));

      const merged = mergeTree(tree1, tree2);

      expect(Object.keys(merged.tree)).toHaveLength(4);
      // activePath should be updated to the latest
      expect(merged.activePath).toEqual(tree2.activePath);
    });

    it('updates activePath to incoming tree path', () => {
      const messagesA = [makeMessage(0, 'user', 'Q'), makeMessage(1, 'assistant', 'A-old')];
      const treeA = buildConversationTree(makeConversationData(messagesA));

      const messagesB = [makeMessage(0, 'user', 'Q'), makeMessage(1, 'assistant', 'A-new')];
      const treeB = buildConversationTree(makeConversationData(messagesB));

      const merged = mergeTree(treeA, treeB);
      expect(merged.activePath).toEqual(treeB.activePath);
    });

    it('updates modified timestamp', () => {
      const data1 = makeConversationData([makeMessage(0, 'user', 'Hi')]);
      data1.extractedAt = new Date('2026-03-01T10:00:00Z');
      const tree1 = buildConversationTree(data1);

      const data2 = makeConversationData([makeMessage(0, 'user', 'Hi')]);
      data2.extractedAt = new Date('2026-03-03T15:00:00Z');
      const tree2 = buildConversationTree(data2);

      const merged = mergeTree(tree1, tree2);
      expect(merged.modified).toBe('2026-03-03T15:00:00.000Z');
      expect(merged.created).toBe('2026-03-01T10:00:00.000Z');
    });

    it('handles deep branching (A→B1→C1, A→B2→C2)', () => {
      // Branch 1: Q → A → Q-follow-1 → A-follow-1
      const branch1 = [
        makeMessage(0, 'user', 'Q'),
        makeMessage(1, 'assistant', 'A'),
        makeMessage(2, 'user', 'Follow-up 1'),
        makeMessage(3, 'assistant', 'Response 1'),
      ];
      const tree1 = buildConversationTree(makeConversationData(branch1));

      // Branch 2: Q → A → Q-follow-2 → A-follow-2
      const branch2 = [
        makeMessage(0, 'user', 'Q'),
        makeMessage(1, 'assistant', 'A'),
        makeMessage(2, 'user', 'Follow-up 2'),
        makeMessage(3, 'assistant', 'Response 2'),
      ];
      const tree2 = buildConversationTree(makeConversationData(branch2));

      const merged = mergeTree(tree1, tree2);

      // 6 nodes: Q, A (shared), Follow-up 1, Response 1, Follow-up 2, Response 2
      expect(Object.keys(merged.tree)).toHaveLength(6);

      // The shared assistant node 'A' should have 2 children
      const sharedAssistantId = tree1.activePath[1]; // same as tree2.activePath[1]
      const sharedNode = merged.tree[sharedAssistantId];
      expect(sharedNode.children).toHaveLength(2);
    });
  });

  describe('serializeTree', () => {
    it('returns valid JSON with 2-space indent', () => {
      const messages = [makeMessage(0, 'user', 'Hello')];
      const tree = buildConversationTree(makeConversationData(messages));
      const json = serializeTree(tree);

      expect(() => JSON.parse(json)).not.toThrow();
      expect(json).toContain('  '); // 2-space indent
      const parsed = JSON.parse(json) as ConversationTree;
      expect(parsed.id).toBe('conv-abc12345');
    });

    it('roundtrips through parse/serialize', () => {
      const messages = [makeMessage(0, 'user', 'Q'), makeMessage(1, 'assistant', 'A')];
      const tree = buildConversationTree(makeConversationData(messages));
      const json = serializeTree(tree);
      const parsed = JSON.parse(json) as ConversationTree;

      expect(parsed.tree).toEqual(tree.tree);
      expect(parsed.activePath).toEqual(tree.activePath);
    });
  });
});
