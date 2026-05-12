import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
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

export const AuthService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    try {
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

      // Determine email
      let email = sanitizedUsername;
      if (!sanitizedUsername.includes("@")) {
        email = `${sanitizedUsername}@qcu.edu.ph`;
      }

      // Validate email format
      if (!SecurityService.validateEmail(email)) {
        return {
          success: false,
          message: "Invalid email or username format.",
        };
      }

      // ============ SECURITY CHECK: Account Lockout ============
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

      // ============ SECURITY: Add delay to prevent brute force ============
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
      // Extract email for rate limiting
      let email = "";
      try {
        email = error.customData?.email || "";
      } catch (e) {
        // Ignore
      }

      // Determine email from username if possible
      if (!email) {
        // Try to infer from error message or use a generic approach
      }

      // ============ SECURITY: Rate limiting on failed attempts ============
      let attemptsRemaining = 5;
      let isNowLocked = false;

      // Reconstruct email if possible
      const usernameFromError = error.customData?.email;
      if (
        usernameFromError &&
        SecurityService.validateEmail(usernameFromError)
      ) {
        const result =
          await SecurityService.recordFailedAttempt(usernameFromError);
        attemptsRemaining = result.attemptsRemaining;
        isNowLocked = result.isNowLocked;
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
          };

        case "auth/internal-error":
          return {
            success: false,
            message: "An internal error occurred. Please try again later.",
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
          };
      }
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
