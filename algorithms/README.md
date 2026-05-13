# QPMS Algorithms Reference

This document outlines all algorithms used in the QPMS (Queens Portal Management System) application with their implementations and use cases.

---

## 1. Quick Sort (with 3-Way Partition)

**Algorithm Name:** Quick Sort with 3-Way Partition

**File Used:** `app/screens/AdminScreen.tsx`

**What it does:** Orders items from newest to oldest, handling duplicates efficiently.

**Where you use it:** Guard Activity Screen & Vehicle Monitoring

**Algorithm Code:**
```typescript
export function quickSort3Way<T>(
  arr: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)];
  const less: T[] = [];
  const equal: T[] = [];
  const greater: T[] = [];

  for (const item of arr) {
    const cmp = compareFn(item, pivot);
    if (cmp < 0) less.push(item);
    else if (cmp === 0) equal.push(item);
    else greater.push(item);
  }

  return [
    ...quickSort3Way(less, compareFn),
    ...equal,
    ...quickSort3Way(greater, compareFn),
  ];
}

// Usage: Sort activity logs (newest first)
quickSort3Way(logs, (a, b) => b.timestamp - a.timestamp);
```

---

## 2. Merge Sort

**Algorithm Name:** Merge Sort

**File Used:** `services/searchService.ts`

**What it does:** Stable sorting that preserves original order for equal items.

**Where you use it:** Admin Dashboard & Audit Logs

**Algorithm Code:**
```typescript
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

function merge<T>(
  left: T[],
  right: T[],
  compareFn: (a: T, b: T) => number
): T[] {
  const result: T[] = [];
  let i = 0,
    j = 0;

  while (i < left.length && j < right.length) {
    if (compareFn(left[i], right[j]) <= 0) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }

  return [...result, ...left.slice(i), ...right.slice(j)];
}

// Usage: Sort audit logs chronologically
mergeSort(auditLogs, (a, b) => a.timestamp - b.timestamp);
```

---

## 3. Hash Set (Duplicate Detection)

**Algorithm Name:** Hash Set for Duplicate Detection

**File Used:** `services/searchService.ts`

**What it does:** Instant "have I seen this before?" checking in O(1) time.

**Where you use it:** User Registration & Admin Panel, Duplicate Prevention

**Algorithm Code:**
```typescript
export class DuplicateChecker {
  private seen: Set<string> = new Set();

  add(value: string): boolean {
    if (this.seen.has(value)) {
      return false; // Already exists
    }
    this.seen.add(value);
    return true; // Added successfully
  }

  has(value: string): boolean {
    return this.seen.has(value);
  }

  clear(): void {
    this.seen.clear();
  }
}

// Usage: Prevent duplicate emails during registration
const emailChecker = new DuplicateChecker();
if (emailChecker.add(newUser.email)) {
  // Email is unique
} else {
  // Email already exists
}

// Usage: Remove duplicate audit log entries
export function removeDuplicateAuditLogs(logs: any[]): any[] {
  const seen = new Set<string>();
  return logs.filter((log) => {
    const key = `${log.plate}-${log.timestamp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
```

---

## 4. Levenshtein Distance (Fuzzy String Matching)

**Algorithm Name:** Levenshtein Distance - Fuzzy String Matching

**File Used:** `services/searchService.ts`

**What it does:** Measures how similar two strings are (typo tolerance).

**Where you use it:** Guard Screen & Admin Dashboard Search

**Algorithm Code:**
```typescript
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function fuzzyMatch(searchTerm: string, candidates: string[]): string[] {
  const normalized = searchTerm.toLowerCase();
  const threshold = 3; // Max edit distance

  return candidates
    .map((candidate) => ({
      text: candidate,
      distance: levenshteinDistance(normalized, candidate.toLowerCase()),
    }))
    .filter((item) => item.distance <= threshold)
    .sort((a, b) => a.distance - b.distance)
    .map((item) => item.text);
}

// Usage: Guard search with typo tolerance
fuzzyMatch("joh", ["john", "jane", "josh"]); // Returns ["john", "josh"]
```

---

## 5. Trie (Prefix Tree)

**Algorithm Name:** Trie (Prefix Tree) for Autocomplete

**File Used:** `services/searchService.ts`

**What it does:** Instant search-as-you-type (autocomplete).

**Where you use it:** Admin Directory Search

**Algorithm Code:**
```typescript
export interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
  value?: any;
}

export class Trie {
  private root: TrieNode = {
    children: new Map(),
    isEnd: false,
  };

  insert(word: string, value: any): void {
    let node = this.root;
    for (const char of word.toUpperCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, {
          children: new Map(),
          isEnd: false,
        });
      }
      node = node.children.get(char)!;
    }
    node.isEnd = true;
    node.value = value;
  }

  search(prefix: string): any[] {
    let node = this.root;
    const results: any[] = [];

    for (const char of prefix.toUpperCase()) {
      if (!node.children.has(char)) return [];
      node = node.children.get(char)!;
    }

    this.dfs(node, results);
    return results;
  }

  private dfs(node: TrieNode, results: any[]): void {
    if (node.isEnd) results.push(node.value);
    for (const child of node.children.values()) {
      this.dfs(child, results);
    }
  }
}

// Usage: Admin directory search
const trie = new Trie();
students.forEach((student) => trie.insert(student.name, student));
const matches = trie.search("mar"); // ["Mark", "Maria", "Martin"]
```

---

## 6. Identifier Resolution (Cascading Search)

**Algorithm Name:** Identifier Resolution with Cascading Search

**File Used:** `services/authService.ts`

**What it does:** Accepts multiple login formats and resolves to email.

**Where you use it:** Login Page & Guard Screen

**Algorithm Code:**
```typescript
export async function resolveIdentifier(
  input: string,
  users: any[]
): Promise<string | null> {
  const normalizedInput = input.toLowerCase().trim();

  // Priority 1: Direct email match
  let user = users.find((u) => u.email.toLowerCase() === normalizedInput);
  if (user) return user.email;

  // Priority 2: Student ID match
  user = users.find((u) => u.studentId?.toLowerCase() === normalizedInput);
  if (user) return user.email;

  // Priority 3: Employee ID match
  user = users.find((u) => u.employeeId?.toLowerCase() === normalizedInput);
  if (user) return user.email;

  // Priority 4: Username match
  user = users.find((u) => u.username?.toLowerCase() === normalizedInput);
  if (user) return user.email;

  return null;
}

// Usage: Login authentication
const email = await resolveIdentifier(userInput, allUsers);
if (email) {
  // Proceed with authentication
}
```

---

## 7. Account Lockout + Time Decay (Security Backoff)

**Algorithm Name:** Account Lockout with Time Decay

**File Used:** `services/securityService.ts`

**What it does:** Temporarily blocks repeated failed login attempts with automatic reset.

**Where you use it:** Authentication System

**Algorithm Code:**
```typescript
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_RESET_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface LoginAttempt {
  email: string;
  timestamp: number;
  isLocked: boolean;
  lockUntil?: number;
  attemptCount: number;
}

export async function checkLoginLocked(
  email: string
): Promise<{ locked: boolean; minutesRemaining: number }> {
  try {
    const attemptData = await getStorageItem(`login_attempt_${email}`);
    if (!attemptData) return { locked: false, minutesRemaining: 0 };

    const attempt: LoginAttempt = JSON.parse(attemptData);
    const now = Date.now();

    // Check if lockout time has expired
    if (attempt.isLocked && attempt.lockUntil && now >= attempt.lockUntil) {
      await removeStorageItem(`login_attempt_${email}`);
      return { locked: false, minutesRemaining: 0 };
    }

    // Time decay: reset attempts if 1 hour has passed
    if (now - attempt.timestamp > ATTEMPT_RESET_DURATION_MS) {
      await removeStorageItem(`login_attempt_${email}`);
      return { locked: false, minutesRemaining: 0 };
    }

    if (attempt.isLocked) {
      const minutesRemaining = Math.ceil(
        (attempt.lockUntil! - now) / (60 * 1000)
      );
      return { locked: true, minutesRemaining };
    }

    return { locked: false, minutesRemaining: 0 };
  } catch {
    return { locked: false, minutesRemaining: 0 };
  }
}

export async function recordFailedAttempt(
  email: string
): Promise<{ attemptsRemaining: number; isNowLocked: boolean }> {
  try {
    let attempt: LoginAttempt = {
      email,
      timestamp: Date.now(),
      isLocked: false,
      attemptCount: 0,
    };

    const storedAttempt = await getStorageItem(`login_attempt_${email}`);
    if (storedAttempt) {
      attempt = JSON.parse(storedAttempt);
      const now = Date.now();

      // Reset if outside reset window
      if (now - attempt.timestamp > ATTEMPT_RESET_DURATION_MS) {
        attempt.attemptCount = 0;
        attempt.isLocked = false;
      }

      attempt.attemptCount += 1;
      attempt.timestamp = now;
    } else {
      attempt.attemptCount = 1;
    }

    // Lock account if max attempts reached
    if (attempt.attemptCount >= MAX_LOGIN_ATTEMPTS) {
      attempt.isLocked = true;
      attempt.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
    }

    await setStorageItem(`login_attempt_${email}`, JSON.stringify(attempt));

    const attemptsRemaining = Math.max(
      0,
      MAX_LOGIN_ATTEMPTS - attempt.attemptCount
    );
    return {
      attemptsRemaining,
      isNowLocked: attempt.isLocked,
    };
  } catch {
    return { attemptsRemaining: MAX_LOGIN_ATTEMPTS, isNowLocked: false };
  }
}
```

---

## 8. Brute Force Throttling

**Algorithm Name:** Brute Force Attack Throttling

**File Used:** `services/securityService.ts`

**What it does:** Slows down rapid login attempts with delay injection.

**Where you use it:** Login Page

**Algorithm Code:**
```typescript
export async function addSecurityDelay(
  milliseconds: number = 500
): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Usage: In login function
export async function loginWithThrottle(
  email: string,
  password: string
): Promise<boolean> {
  // Add delay before processing
  await addSecurityDelay(500);

  // Proceed with authentication
  const isValid = await authenticateUser(email, password);
  return isValid;
}

// Result: Attacker can only try ~2 passwords per second instead of hundreds
```

---

## 9. Email Regex Validation

**Algorithm Name:** Email Format Validation with Regex

**File Used:** `services/securityService.ts`

**What it does:** Checks if email format is valid before using it.

**Where you use it:** Login, Registration, Profile Updates, Admin User Creation

**Algorithm Code:**
```typescript
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Stricter validation
export function validateEmailStrict(email: string): boolean {
  const emailRegex =
    /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Usage:
if (validateEmail("user@example.com")) {
  // Valid email
} else {
  // Invalid format
}
```

---

## 10. Temporary Password Generation

**Algorithm Name:** Secure Random Password Generation

**File Used:** `services/adminService.ts`

**What it does:** Creates secure random passwords.

**Where you use it:** Admin creating new accounts

**Algorithm Code:**
```typescript
export function generateTemporaryPassword(length: number = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";

  const allChars = uppercase + lowercase + numbers + symbols;
  let password = "";

  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

// Usage:
const tempPassword = generateTemporaryPassword(12);
// Result: "aB3$xQ9@mP2L"
```

---

## 11. Multi-Field Filtering

**Algorithm Name:** Multi-Field Filtering and Search

**File Used:** `services/searchService.ts` & `app/screens/AdminScreen.tsx`

**What it does:** Searches across multiple fields simultaneously.

**Where you use it:** Admin User Management

**Algorithm Code:**
```typescript
export function multiFieldFilter(
  items: any[],
  searchTerm: string,
  fields: string[]
): any[] {
  if (!searchTerm) return items;

  const normalized = searchTerm.toLowerCase();

  return items.filter((item) => {
    return fields.some((field) => {
      const value = item[field]?.toString().toLowerCase() || "";
      return value.includes(normalized);
    });
  });
}

// Usage: Search users by name, email, or ID
const results = multiFieldFilter(users, "john", [
  "name",
  "email",
  "studentId",
  "employeeId",
  "role",
]);
// Returns all users where any field contains "john"
```

---

## 12. State Machine (Status Transition)

**Algorithm Name:** State Machine for Status Transitions

**File Used:** `services/guardService.ts`

**What it does:** Tracks valid status changes and prevents invalid transitions.

**Where you use it:** Vehicle Monitoring

**Algorithm Code:**
```typescript
type VehicleStatus = "IN" | "OUT";

const VALID_TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  IN: ["OUT"],
  OUT: ["IN"],
};

export function isValidTransition(
  currentStatus: VehicleStatus,
  newStatus: VehicleStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

export function transitionVehicleStatus(
  vehicle: any,
  newStatus: VehicleStatus
): { success: boolean; message: string } {
  if (!isValidTransition(vehicle.status, newStatus)) {
    return {
      success: false,
      message: `Cannot transition from ${vehicle.status} to ${newStatus}`,
    };
  }

  vehicle.status = newStatus;
  return {
    success: true,
    message: `Vehicle status updated to ${newStatus}`,
  };
}

// Usage: Prevent duplicate "IN" entries
if (transitionVehicleStatus(vehicle, "IN").success) {
  // Update vehicle entry
} else {
  // Show error: Vehicle already checked IN
}
```

---

## Summary

| Algorithm | Time Complexity | Space Complexity | Use Case |
| --- | --- | --- | --- |
| Quick Sort 3-Way | O(n log n) | O(log n) | Activity log sorting |
| Merge Sort | O(n log n) | O(n) | Stable sorting for audit logs |
| Hash Set | O(1) avg | O(n) | Duplicate detection |
| Levenshtein Distance | O(m\*n) | O(m\*n) | Typo tolerance search |
| Trie | O(k) | O(ALPHABET_SIZE\*N) | Autocomplete |
| Identifier Resolution | O(n) | O(1) | Multi-format login |
| Account Lockout | O(1) | O(n) | Security throttling |
| Brute Force Throttling | O(1) | O(1) | Attack prevention |
| Email Regex | O(m) | O(1) | Input validation |
| Temp Password Gen | O(n) | O(n) | Account creation |
| Multi-Field Filter | O(n\*m) | O(n) | Search across fields |
| State Machine | O(1) | O(1) | Valid transitions |

---

**Last Updated:** May 13, 2026
