/**
 * searchService.ts
 *
 * Algorithms implemented:
 *  1. Trie          — instant prefix-based search as the admin types
 *  2. Levenshtein   — fuzzy/typo-tolerant matching when prefix finds nothing
 *  3. Merge Sort    — stable O(n log n) sorting of directory results
 *  4. Hash Set      — O(1) duplicate email / student-ID detection on account creation
 */

// ─────────────────────────────────────────────
// 1. TRIE — prefix search
// ─────────────────────────────────────────────

interface TrieNodeData {
  id: string;
  [key: string]: any;
}

class TrieNode {
  children: Map<string, TrieNode> = new Map();
  records: TrieNodeData[] = []; // items stored at this prefix
  isEnd = false;
}

export class Trie {
  private root = new TrieNode();

  /**
   * Insert a record indexed by every searchable token in it.
   * Tokens: firstName, lastName, studentId / employeeId, email prefix
   */
  insert(record: TrieNodeData, keys: string[]): void {
    for (const key of keys) {
      const word = (record[key] || "").toString().toLowerCase().trim();
      if (!word) continue;
      this._insertWord(word, record);
    }
  }

  private _insertWord(word: string, record: TrieNodeData): void {
    let node = this.root;
    for (const ch of word) {
      if (!node.children.has(ch)) {
        node.children.set(ch, new TrieNode());
      }
      node = node.children.get(ch)!;
      // Store record at each node so prefix search returns it
      if (!node.records.find((r) => r.id === record.id)) {
        node.records.push(record);
      }
    }
    node.isEnd = true;
  }

  /**
   * Return all records whose indexed tokens start with `prefix`.
   */
  search(prefix: string): TrieNodeData[] {
    const lower = prefix.toLowerCase().trim();
    let node = this.root;
    for (const ch of lower) {
      if (!node.children.has(ch)) return [];
      node = node.children.get(ch)!;
    }
    // Deduplicate by id
    const seen = new Set<string>();
    const results: TrieNodeData[] = [];
    for (const record of node.records) {
      if (!seen.has(record.id)) {
        seen.add(record.id);
        results.push(record);
      }
    }
    return results;
  }
}

// ─────────────────────────────────────────────
// 2. LEVENSHTEIN — fuzzy / typo-tolerant search
// ─────────────────────────────────────────────

/**
 * Compute the edit distance between two strings.
 * Lower = more similar. 0 = identical.
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // dp[i][j] = edit distance between a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]; // no operation needed
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
      }
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy-search a list of records.
 * Returns records where any token's edit distance to `query` is ≤ threshold.
 */
export function fuzzySearch<T extends TrieNodeData>(
  records: T[],
  query: string,
  keys: string[],
  threshold = 2
): T[] {
  const lower = query.toLowerCase().trim();
  const results: T[] = [];

  for (const record of records) {
    let matched = false;
    for (const key of keys) {
      const value = (record[key] || "").toString().toLowerCase();
      // Check every word in the value against the query
      const words = value.split(/\s+/);
      for (const word of words) {
        if (levenshteinDistance(word, lower) <= threshold) {
          matched = true;
          break;
        }
      }
      if (matched) break;
    }
    if (matched) results.push(record);
  }

  return results;
}

// ─────────────────────────────────────────────
// 3. MERGE SORT — stable O(n log n) sort
// ─────────────────────────────────────────────

export type SortKey = "name" | "studentId" | "employeeId" | "createdAt" | "status";
export type SortOrder = "asc" | "desc";

/**
 * Merge Sort implementation — stable, O(n log n).
 * Used to sort the admin directory by any column.
 */
export function mergeSort<T>(
  arr: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compareFn);
  const right = mergeSort(arr.slice(mid), compareFn);

  return merge(left, right, compareFn);
}

function merge<T>(left: T[], right: T[], compareFn: (a: T, b: T) => number): T[] {
  const result: T[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (compareFn(left[i], right[j]) <= 0) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }

  return result.concat(left.slice(i)).concat(right.slice(j));
}

/**
 * Build a comparator for DirectoryUser-like objects.
 */
export function buildComparator<T extends Record<string, any>>(
  key: string,
  order: SortOrder = "asc"
): (a: T, b: T) => number {
  return (a, b) => {
    let valA = a[key];
    let valB = b[key];

    if (valA instanceof Date && valB instanceof Date) {
      valA = valA.getTime();
      valB = valB.getTime();
    } else if (typeof valA === "string" && typeof valB === "string") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    } else if (typeof valA === "boolean") {
      // true (ACTIVE) sorts before false (PENDING)
      valA = valA ? 0 : 1;
      valB = valB ? 0 : 1;
    }

    if (valA < valB) return order === "asc" ? -1 : 1;
    if (valA > valB) return order === "asc" ? 1 : -1;
    return 0;
  };
}

// ─────────────────────────────────────────────
// 4. HASH SET — O(1) duplicate detection
// ─────────────────────────────────────────────

export class DuplicateChecker {
  private emailSet: Set<string> = new Set();
  private studentIdSet: Set<string> = new Set();
  private employeeIdSet: Set<string> = new Set();

  /**
   * Load the existing records into the hash sets.
   * Call this once after fetching from Firestore.
   */
  load(records: Array<{ email?: string; studentId?: string; employeeId?: string }>): void {
    this.emailSet.clear();
    this.studentIdSet.clear();
    this.employeeIdSet.clear();

    for (const r of records) {
      if (r.email) this.emailSet.add(r.email.toLowerCase());
      if (r.studentId) this.studentIdSet.add(r.studentId.toLowerCase());
      if (r.employeeId) this.employeeIdSet.add(r.employeeId.toLowerCase());
    }
  }

  /** O(1) — returns true if email is already taken */
  hasEmail(email: string): boolean {
    return this.emailSet.has(email.toLowerCase());
  }

  /** O(1) — returns true if student ID is already taken */
  hasStudentId(id: string): boolean {
    return this.studentIdSet.has(id.toLowerCase());
  }

  /** O(1) — returns true if employee ID is already taken */
  hasEmployeeId(id: string): boolean {
    return this.employeeIdSet.has(id.toLowerCase());
  }

  /** Add a newly created record to keep sets in sync */
  add(record: { email?: string; studentId?: string; employeeId?: string }): void {
    if (record.email) this.emailSet.add(record.email.toLowerCase());
    if (record.studentId) this.studentIdSet.add(record.studentId.toLowerCase());
    if (record.employeeId) this.employeeIdSet.add(record.employeeId.toLowerCase());
  }
}

// ─────────────────────────────────────────────
// 5. COMBINED SEARCH — Trie first, Levenshtein fallback, Merge Sort output
// ─────────────────────────────────────────────

export interface SearchableUser {
  id: string;
  firstName: string;
  lastName: string;
  name?: string;
  email: string;
  studentId?: string;
  employeeId?: string;
  isActive: boolean;
  createdAt: Date;
  [key: string]: any;
}

const SEARCH_KEYS = ["firstName", "lastName", "name", "studentId", "employeeId", "email"];

/**
 * Build a Trie index from an array of users.
 */
export function buildTrie(users: SearchableUser[]): Trie {
  const trie = new Trie();
  for (const user of users) {
    trie.insert(user, SEARCH_KEYS);
  }
  return trie;
}

/**
 * Full search pipeline:
 *  1. Trie prefix search (fast)
 *  2. If no results → Levenshtein fuzzy fallback
 *  3. Merge Sort the results
 */
export function searchAndSort(
  trie: Trie,
  allUsers: SearchableUser[],
  query: string,
  sortKey: string = "firstName",
  sortOrder: SortOrder = "asc"
): SearchableUser[] {
  let results: SearchableUser[];

  if (!query.trim()) {
    // No query — return all users sorted
    results = [...allUsers];
  } else {
    // Step 1: Trie prefix search
    const trieResults = trie.search(query) as SearchableUser[];

    if (trieResults.length > 0) {
      results = trieResults;
    } else {
      // Step 2: Levenshtein fuzzy fallback (threshold = 2 edits)
      results = fuzzySearch(allUsers, query, SEARCH_KEYS, 2);
    }
  }

  // Step 3: Merge Sort
  const comparator = buildComparator<SearchableUser>(sortKey, sortOrder);
  return mergeSort(results, comparator);
}
