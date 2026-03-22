/** Serialized trie node state. */
export interface TrieNodeState {
  children: Record<string, TrieNodeState>;
  isLeaf: boolean;
}

/** Mutable trie node used by {@link SimpleStringTrie}. */
export class TrieNode {
  children: Map<string, TrieNode>;
  isLeaf: boolean;

  constructor(state?: TrieNodeState) {
    this.children = new Map<string, TrieNode>();
    this.isLeaf = state?.isLeaf ?? false;
    if (state) {
      for (const [key, child] of Object.entries(state.children)) {
        this.children.set(key, new TrieNode(child));
      }
    }
  }

  strings(): string[] {
    const results: string[] = [];
    for (const [key, node] of this.children.entries()) {
      if (node.isLeaf) {
        results.push(key);
      }
      for (const suffix of node.strings()) {
        results.push(key + suffix);
      }
    }
    return results;
  }

  toState(): TrieNodeState {
    const children: Record<string, TrieNodeState> = {};
    for (const [key, value] of this.children.entries()) {
      children[key] = value.toState();
    }
    return {
      children,
      isLeaf: this.isLeaf
    };
  }
}

/** Simple trie implementation for prefix lookup and completion. */
export class SimpleStringTrie {
  constructor(public readonly root: TrieNode = new TrieNode()) {}

  add(input: string): void {
    let currentNode = this.root;
    for (const char of input) {
      let next = currentNode.children.get(char);
      if (!next) {
        next = new TrieNode();
        currentNode.children.set(char, next);
      }
      currentNode = next;
    }
    currentNode.isLeaf = true;
  }

  get(input: string): string | null {
    let currentNode = this.root;
    let i = 0;
    for (const char of input) {
      const nextNode = currentNode.children.get(char);
      if (nextNode) {
        i += 1;
        currentNode = nextNode;
      } else {
        if (i > 0 && currentNode.isLeaf) {
          return input.slice(0, i);
        }
      }
    }
    return i > 0 && currentNode.isLeaf ? input.slice(0, i) : null;
  }

  match(input: string): string[] {
    return this.addMoreStrings(input, "", this.root);
  }

  private addMoreStrings(input: string, prefix: string, startNode: TrieNode): string[] {
    let currentNode = startNode;
    let i = 0;
    const results: string[] = [];
    for (const char of input) {
      const nextNode = currentNode.children.get(char);
      if (nextNode) {
        i += 1;
        currentNode = nextNode;
      }
    }
    const matched = input.slice(0, i);
    if (i > 0 && currentNode.isLeaf) {
      results.push(prefix + matched);
    }
    if (currentNode !== this.root && i === input.length) {
      for (const suffix of currentNode.strings()) {
        results.push(prefix + matched + suffix);
      }
    }
    return results;
  }

  static from(map: Record<string, unknown> | Map<string, unknown>): SimpleStringTrie {
    const trie = new SimpleStringTrie();
    const keys = map instanceof Map ? [...map.keys()] : Object.keys(map);
    for (const key of keys) {
      trie.add(key);
    }
    return trie;
  }
}
