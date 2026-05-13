import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs } from "firebase/firestore";
import { authRef, db } from "./firebaseConfig";
import { SecurityService } from "./securityService";

// User interface matching your existing structure
export interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "faculty" | "staff" | "guard" | "admin";
  studentId?: string;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  message: string;
  attemptsRemaining?: number;
  minutesLocked?: number;
}

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * ALGORITHM: IDENTIFIER RESOLUTION (Multi-Step Cascading Search)
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Purpose: Convert username/ID input to email through multi-step fallback logic
 * 
 * Steps:
 *  1. Check if input is already an email → validate & return
 *  2. Search students collection by studentId
 *  3. Search guards collection by employeeId
 *  4. Try as username with domain suffix (username@qcu.edu.ph)
 * 
 * Complexity: O(n) for database queries, O(1) for email validation
 * Use case: Allow users to login with email, student ID, employee ID, or username
 * ════════════════════════════════════════════════════════════════════════════════
 */
const resolveIdentifierToEmail = async (identifier: string): Promise<string | null> => {
  const sanitized = identifier.trim();
  
  // STEP 1: Check if input is already an email
  if (sanitized.includes("@")) {
    return SecurityService.validateEmail(sanitized) ? sanitized : null;
  }
  
  // STEP 2: Search in students collection by studentId
  try {
    const studentsRef = collection(db, "students");
    const q = query(
      studentsRef,
      where("studentId", "==", sanitized)
    );
    const snapshot = await getDocs(q);
    if (snapshot.size > 0) {
      const userData = snapshot.docs[0].data();
      return userData.email || null;
    }
  } catch (error) {
    console.error("Error searching students by ID:", error);
  }
  
  // STEP 3: Search in guards collection by employeeId
  try {
    const guardsRef = collection(db, "guards");
    const q = query(
      guardsRef,
      where("employeeId", "==", sanitized)
    );
    const snapshot = await getDocs(q);
    if (snapshot.size > 0) {
      const userData = snapshot.docs[0].data();
      return userData.email || null;
    }
  } catch (error) {
    console.error("Error searching guards by ID:", error);
  }
  
  // STEP 4: Try as username with domain suffix
  const emailFromUsername = `${sanitized}@qcu.edu.ph`;
  return SecurityService.validateEmail(emailFromUsername) ? emailFromUsername : null;
};

export const AuthService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    // Input validation
    if (!username || !password) {
      console.warn("⚠️ Missing username or password");
      return {
        success: false,
        message: "Please enter both username and password.",
      };
    }

    // Trim and sanitize inputs
    const sanitizedUsername = username.trim();
    const sanitizedPassword = password.trim();

    if (sanitizedUsername.length === 0 || sanitizedPassword.length === 0) {
      return {
        success: false,
        message: "Username and password cannot be empty.",
      };
    }

    // Determine email by resolving identifier (email, student ID, or guard ID)
    // DO THIS OUTSIDE THE TRY BLOCK so email is available in catch block
    let email = "";
    try {
      email = (await resolveIdentifierToEmail(sanitizedUsername)) || "";
      // Normalize email: trim and lowercase for consistency in storage
      email = email.trim().toLowerCase();
      console.log("🔍 Resolved email:", email);
    } catch (resolveError) {
      console.warn("Error resolving identifier:", resolveError);
      return {
        success: false,
        message: "Invalid email, student ID, or username format.",
      };
    }

    try {
      // Email validation
      if (!email) {
        return {
          success: false,
          message: "User not found. Invalid email, student ID, or username.",
        };
      }

      // ════════════════════════════════════════════════════════════════════════
      // CHECK: Verify user exists in database before authenticating
      // ════════════════════════════════════════════════════════════════════════
      let userExists = false;
      
      try {
        // Search in students collection
        let userQuery = query(
          collection(db, "students"),
          where("email", "==", email)
        );
        let snapshot = await getDocs(userQuery);
        if (snapshot.size > 0) {
          userExists = true;
        }
        
        // Search in faculty collection
        if (!userExists) {
          userQuery = query(
            collection(db, "faculty"),
            where("email", "==", email)
          );
          snapshot = await getDocs(userQuery);
          if (snapshot.size > 0) {
            userExists = true;
          }
        }
        
        // Search in staff collection
        if (!userExists) {
          userQuery = query(
            collection(db, "staff"),
            where("email", "==", email)
          );
          snapshot = await getDocs(userQuery);
          if (snapshot.size > 0) {
            userExists = true;
          }
        }
        
        // Search in guards collection
        if (!userExists) {
          userQuery = query(
            collection(db, "guards"),
            where("email", "==", email)
          );
          snapshot = await getDocs(userQuery);
          if (snapshot.size > 0) {
            userExists = true;
          }
        }
        
        // Search in admins collection
        if (!userExists) {
          userQuery = query(
            collection(db, "admins"),
            where("email", "==", email)
          );
          snapshot = await getDocs(userQuery);
          if (snapshot.size > 0) {
            userExists = true;
          }
        }
      } catch (checkError) {
        console.error("Error checking user existence:", checkError);
      }
      
      // If user doesn't exist in any collection, return error immediately
      if (!userExists) {
        await SecurityService.logSecurityEvent({
          type: "LOGIN_USER_NOT_FOUND",
          email,
          details: `Login attempt for non-existent user: ${sanitizedUsername}`,
        });
        return {
          success: false,
          message: "User not found. Please check your credentials.",
        };
      }

      // ════════════════════════════════════════════════════════════════════════
      // ACCOUNT LOCKOUT MECHANISM (Brute Force Prevention)
      // ════════════════════════════════════════════════════════════════════════
      const { locked, minutesRemaining } =
        await SecurityService.isAccountLocked(email);
      if (locked) {
        await SecurityService.logSecurityEvent({
          type: "LOCKED_ACCOUNT_LOGIN_ATTEMPT",
          email,
          details: `Attempted login on locked account`,
        });
        return {
          success: false,
          message: `Account is locked due to too many failed login attempts. Please try again in ${minutesRemaining} minutes.`,
          minutesLocked: minutesRemaining,
        };
      }

      // ════════════════════════════════════════════════════════════════════════
      // ALGORITHM: BRUTE FORCE THROTTLING (Rate Limiting)
      // ════════════════════════════════════════════════════════════════════════
      // - Adds artificial 500ms delay on every login attempt
      // - Slows down automated attack scripts
      // - O(1) operation
      // ════════════════════════════════════════════════════════════════════════
      await SecurityService.addSecurityDelay(500);

      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(
        authRef,
        email,
        password,
      );
      const firebaseUser = userCredential.user;

      // Force-reload the user so emailVerified is fresh from the server,
      // not the stale cached value from the auth token.
      await firebaseUser.reload();

      // Get user profile from Firestore - try all collections
      let userDoc: any = null;
      let userRole: "student" | "faculty" | "staff" | "guard" | "admin" | null =
        null;

      // Try students collection
      let docRef = doc(db, "students", firebaseUser.uid);
      let tempDoc = await getDoc(docRef);
      if (tempDoc.exists()) {
        userDoc = tempDoc;
        userRole = "student";
      }

      // Try faculty collection if not found
      if (!userDoc) {
        docRef = doc(db, "faculty", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "faculty";
        }
      }

      // Try staff collection if not found
      if (!userDoc) {
        docRef = doc(db, "staff", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "staff";
        }
      }

      // Try guards collection if not found
      if (!userDoc) {
        docRef = doc(db, "guards", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "guard";
        }
      }

      // Try admins collection if not found
      if (!userDoc) {
        docRef = doc(db, "admins", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "admin";
        }
      }

      if (!userDoc) {
        await SecurityService.logSecurityEvent({
          type: "LOGIN_PROFILE_NOT_FOUND",
          email,
          details: `Firebase auth succeeded but Firestore profile not found in any collection`,
        });
        return {
          success: false,
          message: "User profile not found. Please contact administrator.",
        };
      }

      const userData = userDoc.data();

      // Verify required fields
      if (!userData.role) {
        return {
          success: false,
          message: "User account configuration error. Please contact support.",
        };
      }

      // ============ ACTIVATION GATE ============
      // Non-admin accounts must verify their email before logging in.
      // firebaseUser.emailVerified is fresh (we called reload() above).
      if (userRole !== "admin" && !firebaseUser.emailVerified) {
        // Sign the user back out — don't let them in
        await signOut(authRef);
        await SecurityService.logSecurityEvent({
          type: "LOGIN_BLOCKED_UNVERIFIED",
          email,
          details: "Login blocked: email not yet verified",
        });
        return {
          success: false,
          message:
            "⚠️ Account not activated yet.\n\nPlease check your email and click the verification link to activate your account.",
        };
      }
      // =========================================

      // ============ AUTO-ACTIVATE: If email is verified but Firestore is still pending ============
      if (
        firebaseUser.emailVerified &&
        userData.isActive === false &&
        userRole !== "admin"
      ) {
        try {
          const activationData = {
            isActive: true,
            emailVerified: true,
            accountStatus: "ACTIVE",
            activatedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          };
          // Update the user document
          await updateDoc(userDoc.ref, activationData);
          // Also activate the QR code so guard can scan it
          const qrRef = doc(db, "qr_codes", firebaseUser.uid);
          await updateDoc(qrRef, {
            isActive: true,
            activatedAt: Timestamp.now(),
          });
        } catch (activationError) {
          console.error("Error auto-activating account:", activationError);
          // Non-fatal: login still succeeds
        }
      }

      // ============ SUCCESS: Clear failed attempts ============
      await SecurityService.clearLoginAttempts(email);

      const user: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || email,
        name:
          userData.name ||
          `${userData.firstName || userData.FirstName || ""} ${userData.lastName || userData.lastNameName || ""}`.trim() ||
          firebaseUser.email?.split("@")[0] ||
          "User",
        role: userData.role as "student" | "guard" | "admin",
        studentId: userData.studentId || userData.employeeId,
      };

      // Log successful login
      await SecurityService.logSecurityEvent({
        type: "SUCCESSFUL_LOGIN",
        email,
        details: `User ${user.name} logged in successfully`,
      });

      return {
        success: true,
        user,
        message: `Welcome, ${user.name}`,
      };
    } catch (error: any) {
      // ============ SECURITY: Rate limiting on failed attempts ============
      // Use the email we resolved earlier (guaranteed to be valid)
      let attemptsRemaining = 5;
      let isNowLocked = false;

      // Record failed attempt with the resolved email
      if (email) {
        console.log("📊 Recording failed attempt for:", email);
        const result = await SecurityService.recordFailedAttempt(email);
        attemptsRemaining = result.attemptsRemaining;
        isNowLocked = result.isNowLocked;
        console.log("📊 Attempts remaining:", attemptsRemaining, "Locked:", isNowLocked);
      } else {
        console.warn("⚠️ Email not available for attempt tracking");
      }

      // Handle specific Firebase errors with better messages
      switch (error.code) {
        case "auth/user-not-found":
          await SecurityService.logSecurityEvent({
            type: "FAILED_LOGIN_USER_NOT_FOUND",
            email,
            attempts: 5 - attemptsRemaining,
          });
          return {
            success: false,
            message: "Username or password is incorrect.",
            attemptsRemaining,
          };

        case "auth/wrong-password":
          await SecurityService.logSecurityEvent({
            type: "FAILED_LOGIN_WRONG_PASSWORD",
            email,
            attempts: 5 - attemptsRemaining,
          });

          if (isNowLocked) {
            return {
              success: false,
              message: `Your account has been locked due to too many failed login attempts. Please try again in 15 minutes for security reasons.`,
              attemptsRemaining: 0,
            };
          }

          return {
            success: false,
            message: "Username or password is incorrect.",
            attemptsRemaining,
          };

        case "auth/invalid-email":
          console.warn("⚠️ Invalid email format");
          return {
            success: false,
            message: "Invalid email format. Please check your username.",
            attemptsRemaining,
          };

        case "auth/invalid-credential":
          await SecurityService.logSecurityEvent({
            type: "FAILED_LOGIN_INVALID_CREDENTIALS",
            email,
          });

          if (isNowLocked) {
            return {
              success: false,
              message: `Your account has been locked due to too many failed login attempts. Please try again in 15 minutes for security reasons.`,
              attemptsRemaining: 0,
            };
          }

          return {
            success: false,
            message: "Username or password is incorrect.",
            attemptsRemaining,
          };

        case "auth/too-many-requests":
          await SecurityService.logSecurityEvent({
            type: "TOO_MANY_REQUESTS",
            email,
            details: "Firebase rate limit triggered",
          });
          return {
            success: false,
            message:
              "Too many login attempts. Please try again in a few minutes.",
            attemptsRemaining,
          };

        case "auth/network-request-failed":
          await SecurityService.logSecurityEvent({
            type: "NETWORK_ERROR",
            email,
            details: error.message,
          });
          return {
            success: false,
            message: "Network error. Please check your internet connection.",
            attemptsRemaining,
          };

        case "auth/internal-error":
          return {
            success: false,
            message: "An internal error occurred. Please try again later.",
            attemptsRemaining,
          };

        default:
          await SecurityService.logSecurityEvent({
            type: "LOGIN_ERROR",
            email,
            details: `${error.code}: ${error.message}`,
          });
          return {
            success: false,
            message:
              "Login failed. Please check your connection and try again.",
            attemptsRemaining,
          };
      }
    }
  },

  sendPasswordReset: async (identifier: string): Promise<{ success: boolean; message: string }> => {
    try {
      const sanitized = identifier.trim();
      
      if (!sanitized) {
        return {
          success: false,
          message: "Please enter your email or ID.",
        };
      }

      // Resolve identifier to email
      const email = await resolveIdentifierToEmail(sanitized);
      if (!email) {
        return {
          success: false,
          message: "Email or ID not found. Please check and try again.",
        };
      }

      // Send password reset email
      await sendPasswordResetEmail(authRef, email);

      await SecurityService.logSecurityEvent({
        type: "PASSWORD_RESET_REQUESTED",
        email,
        details: `Password reset email sent`,
      });

      return {
        success: true,
        message: `Password reset email sent to ${email}. Please check your inbox and follow the link to reset your password.`,
      };
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      let errorMessage = "Failed to send password reset email.";
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with that email or ID.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format.";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many attempts. Please try again later.";
      }

      await SecurityService.logSecurityEvent({
        type: "PASSWORD_RESET_FAILED",
        email: identifier,
        details: errorMessage,
      });

      return {
        success: false,
        message: errorMessage,
      };
    }
  },

  logout: async () => {
    try {
      const user = authRef.currentUser;
      if (user?.email) {
        await SecurityService.logSecurityEvent({
          type: "LOGOUT",
          email: user.email,
          details: `User logged out`,
        });
      }
      await signOut(authRef);
      return { success: true, message: "Logged out successfully" };
    } catch (error: any) {
      return { success: false, message: "Logout failed" };
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    const firebaseUser = authRef.currentUser;
    if (!firebaseUser) {
      return null;
    }

    try {
      // Reload to get fresh emailVerified state from the server
      await firebaseUser.reload();

      let userDoc: any = null;
      let userRole: "student" | "faculty" | "staff" | "guard" | "admin" | null =
        null;

      // Try students collection
      let docRef = doc(db, "students", firebaseUser.uid);
      let tempDoc = await getDoc(docRef);
      if (tempDoc.exists()) {
        userDoc = tempDoc;
        userRole = "student";
      }

      // Try faculty collection if not found
      if (!userDoc) {
        docRef = doc(db, "faculty", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "faculty";
        }
      }

      // Try staff collection if not found
      if (!userDoc) {
        docRef = doc(db, "staff", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "staff";
        }
      }

      // Try guards collection if not found
      if (!userDoc) {
        docRef = doc(db, "guards", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "guard";
        }
      }

      // Try admins collection if not found
      if (!userDoc) {
        docRef = doc(db, "admins", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "admin";
        }
      }

      if (!userDoc) {
        return null;
      }

      const userData = userDoc.data();

      // AUTO-ACTIVATE: if email is now verified but Firestore is still pending
      if (
        firebaseUser.emailVerified &&
        userData.isActive === false &&
        userRole !== "admin"
      ) {
        try {
          await updateDoc(userDoc.ref, {
            isActive: true,
            emailVerified: true,
            accountStatus: "ACTIVE",
            activatedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          // Activate the QR code too
          const qrRef = doc(db, "qr_codes", firebaseUser.uid);
          await updateDoc(qrRef, {
            isActive: true,
            activatedAt: Timestamp.now(),
          });
        } catch (activationError) {
          console.error("Error auto-activating account:", activationError);
        }
      }

      return {
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        name:
          userData.name ||
          `${userData.firstName || userData.FirstName || ""} ${userData.lastName || userData.lastNameName || ""}`.trim() ||
          firebaseUser.email?.split("@")[0] ||
          "User",
        role: userRole || userData.role || "student",
        studentId: userData.studentId || userData.employeeId,
      };
    } catch (error) {
      return null;
    }
  },

  // Subscribe to auth state changes
  onAuthStateChange: (callback: (user: User | null) => void) => {
    return onAuthStateChanged(authRef, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await AuthService.getCurrentUser();
        if (user) {
          await SecurityService.logSecurityEvent({
            type: "AUTH_STATE_RESTORED",
            email: user.email,
            details: "Session restored from storage",
          });
        }
        callback(user);
      } else {
        callback(null);
      }
    });
  },
};
