import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_RESET_DURATION_MS = 60 * 60 * 1000; // 1 hour

// In-memory fallback storage for when AsyncStorage is unavailable
const memoryStorage: { [key: string]: string } = {};

interface LoginAttempt {
  email: string;
  timestamp: number;
  isLocked: boolean;
  lockUntil?: number;
  attemptCount: number;
}

// Helper to safely get items from AsyncStorage with fallback
const safeGetItem = async (key: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn("⚠️ AsyncStorage.getItem failed, using fallback:", error);
    return memoryStorage[key] || null;
  }
};

// Helper to safely set items in AsyncStorage with fallback
const safeSetItem = async (key: string, value: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.warn("⚠️ AsyncStorage.setItem failed, using fallback:", error);
    memoryStorage[key] = value;
  }
};

// Helper to safely remove items from AsyncStorage with fallback
const safeRemoveItem = async (key: string): Promise<void> => {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.warn("⚠️ AsyncStorage.removeItem failed, using fallback:", error);
    delete memoryStorage[key];
  }
};

export const SecurityService = {
  /**
   * ════════════════════════════════════════════════════════════════════════════
   * ALGORITHM: ACCOUNT LOCKOUT MECHANISM (Exponential Backoff)
   * ════════════════════════════════════════════════════════════════════════════
   * 
   * Purpose: Prevent brute force attacks by locking accounts after failed attempts
   * 
   * Logic:
   *  - Track failed attempts per email with timestamp
   *  - After MAX_LOGIN_ATTEMPTS (5), lock account for LOCKOUT_DURATION_MS (15 min)
   *  - If lockout time expired → unlock and reset attempts
   *  - If no attempts within ATTEMPT_RESET_DURATION_MS (1 hour) → reset counter
   * 
   * Time Complexity: O(1) - simple comparisons
   * Space Complexity: O(1) per email
   * ════════════════════════════════════════════════════════════════════════════
   */
  isAccountLocked: async (
    email: string,
  ): Promise<{ locked: boolean; minutesRemaining: number }> => {
    try {
      const storedAttempt = await safeGetItem(`login_attempt_${email}`);

      if (!storedAttempt) {
        return { locked: false, minutesRemaining: 0 };
      }

      const attempt: LoginAttempt = JSON.parse(storedAttempt);
      const now = Date.now();

      // Check if lockout has expired
      if (attempt.isLocked && attempt.lockUntil && now > attempt.lockUntil) {
        await safeRemoveItem(`login_attempt_${email}`);
        return { locked: false, minutesRemaining: 0 };
      }

      if (attempt.isLocked) {
        const minutesRemaining = Math.ceil((attempt.lockUntil! - now) / 60000);
        return { locked: true, minutesRemaining };
      }

      // ──────────────────────────────────────────────────────────────────────
      // ALGORITHM: TIME-WINDOW ATTEMPT RESET (Decay Pattern)
      // ──────────────────────────────────────────────────────────────────────
      // Reset counter if no attempts within 1 hour (ATTEMPT_RESET_DURATION_MS)
      // This allows legitimate users to recover from temporary lockout
      // ──────────────────────────────────────────────────────────────────────
      if (now - attempt.timestamp > ATTEMPT_RESET_DURATION_MS) {
        await safeRemoveItem(`login_attempt_${email}`);
        return { locked: false, minutesRemaining: 0 };
      }

      return { locked: false, minutesRemaining: 0 };
    } catch {
      return { locked: false, minutesRemaining: 0 };
    }
  },

  /**
   * Record a failed login attempt
   */
  recordFailedAttempt: async (
    email: string,
  ): Promise<{ attemptsRemaining: number; isNowLocked: boolean }> => {
    try {
      const storedAttempt = await safeGetItem(`login_attempt_${email}`);
      let attempt: LoginAttempt = {
        email,
        timestamp: Date.now(),
        isLocked: false,
        attemptCount: 0,
      };

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

        // Log security event
        await SecurityService.logSecurityEvent({
          type: "ACCOUNT_LOCKED",
          email,
          attempts: attempt.attemptCount,
          timestamp: new Date().toISOString(),
        });
      }

      await safeSetItem(`login_attempt_${email}`, JSON.stringify(attempt));

      const attemptsRemaining = Math.max(
        0,
        MAX_LOGIN_ATTEMPTS - attempt.attemptCount,
      );
      return {
        attemptsRemaining,
        isNowLocked: attempt.isLocked,
      };
    } catch {
      return { attemptsRemaining: MAX_LOGIN_ATTEMPTS, isNowLocked: false };
    }
  },

  /**
   * Clear login attempts for an email (call after successful login)
   */
  clearLoginAttempts: async (email: string): Promise<void> => {
    try {
      await safeRemoveItem(`login_attempt_${email}`);
    } catch {}
  },

  /**
   * Validate email format
   */
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   */
  validatePasswordStrength: (
    password: string,
  ): { valid: boolean; message?: string } => {
    if (password.length < 6) {
      return {
        valid: false,
        message: "Password must be at least 6 characters long",
      };
    }

    // Optional: Add more requirements
    // if (!/[A-Z]/.test(password)) {
    //   return { valid: false, message: 'Password must contain at least one uppercase letter' };
    // }

    return { valid: true };
  },

  /**
   * Log security events for monitoring
   */
  logSecurityEvent: async (event: {
    type: string;
    email?: string;
    userId?: string;
    adminId?: string;
    role?: string;
    studentId?: string;
    employeeId?: string;
    details?: string;
    attempts?: number;
    error?: string;
    timestamp?: string;
  }): Promise<void> => {
    try {
      const timestamp = event.timestamp || new Date().toISOString();
      const eventLog = {
        ...event,
        timestamp,
      };

      // Store locally
      const logs = await safeGetItem("security_logs");
      const logArray = logs ? JSON.parse(logs) : [];

      logArray.push(eventLog);

      // Keep only last 100 events
      if (logArray.length > 100) {
        logArray.shift();
      }

      await safeSetItem("security_logs", JSON.stringify(logArray));

      // TODO: In production, send to backend for monitoring
      // Example:
      // await fetch('https://your-api.com/log-security-event', {
      //   method: 'POST',
      //   body: JSON.stringify(eventLog),
      // });
    } catch {}
  },

  /**
   * Get security data (generic storage for rate limits, etc.)
   */
  getSecurityData: async (key: string): Promise<string | null> => {
    try {
      return await safeGetItem(`security_${key}`);
    } catch (error) {
      console.error("Error retrieving security data:", error);
      return null;
    }
  },

  /**
   * Set security data (generic storage for rate limits, etc.)
   */
  setSecurityData: async (key: string, value: string): Promise<void> => {
    try {
      await safeSetItem(`security_${key}`, value);
    } catch (error) {
      console.error("Error setting security data:", error);
    }
  },

  /**
   * Get security logs (for admin/debugging)
   */
  getSecurityLogs: async (): Promise<any[]> => {
    try {
      const logs = await safeGetItem("security_logs");
      return logs ? JSON.parse(logs) : [];
    } catch (error) {
      console.error("❌ Error retrieving security logs:", error);
      return [];
    }
  },

  /**
   * Clear all security logs
   */
  clearSecurityLogs: async (): Promise<void> => {
    try {
      await safeRemoveItem("security_logs");
    } catch {}
  },

  /**
   * Add delay to prevent brute force attacks
   */
  addSecurityDelay: async (milliseconds: number = 500): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  },
};
