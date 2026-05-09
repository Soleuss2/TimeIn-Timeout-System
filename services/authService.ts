import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { authRef, db } from "./firebaseConfig";
import { SecurityService } from "./securityService";

// User interface matching your existing structure
export interface User {
  id: string;
  email: string;
  name: string;
  role: "student" | "guard" | "admin";
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
        console.warn("⚠️ Invalid email format:", email);
        return {
          success: false,
          message: "Invalid email or username format.",
        };
      }

      // ============ SECURITY CHECK: Account Lockout ============
      const { locked, minutesRemaining } =
        await SecurityService.isAccountLocked(email);
      if (locked) {
        console.warn("🔒 Login attempt on locked account:", email);
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

      console.log("🔐 Attempting login with:", email);

      // Sign in with Firebase
      const userCredential = await signInWithEmailAndPassword(
        authRef,
        email,
        password,
      );
      const firebaseUser = userCredential.user;

      console.log("✅ Firebase auth successful:", firebaseUser.uid);

      // Get user profile from Firestore - try all collections
      let userDoc: any = null;
      let userRole: "student" | "guard" | "admin" | null = null;

      // Try students collection
      let docRef = doc(db, "students", firebaseUser.uid);
      let tempDoc = await getDoc(docRef);
      if (tempDoc.exists()) {
        userDoc = tempDoc;
        userRole = "student";
        console.log("✅ User found in students collection");
      }

      // Try guards collection if not found
      if (!userDoc) {
        docRef = doc(db, "guards", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "guard";
          console.log("✅ User found in guards collection");
        }
      }

      // Try admins collection if not found
      if (!userDoc) {
        docRef = doc(db, "admins", firebaseUser.uid);
        tempDoc = await getDoc(docRef);
        if (tempDoc.exists()) {
          userDoc = tempDoc;
          userRole = "admin";
          console.log("✅ User found in admins collection");
        }
      }

      if (!userDoc) {
        console.warn(
          "⚠️ User document not found in any collection:",
          firebaseUser.uid,
        );
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
      console.log("✅ User data retrieved:", userData);

      // Verify required fields
      if (!userData.role) {
        console.warn("⚠️ User role not defined:", firebaseUser.uid);
        return {
          success: false,
          message: "User account configuration error. Please contact support.",
        };
      }

      // ============ SUCCESS: Clear failed attempts ============
      await SecurityService.clearLoginAttempts(email);

      const user: User = {
        id: firebaseUser.uid,
        email: firebaseUser.email || email,
        name: userData.name || firebaseUser.email?.split("@")[0] || "User",
        role: userData.role as "student" | "guard" | "admin",
        studentId: userData.studentId || userData.employeeId,
      };

      console.log("✅ Login successful for:", user.name);

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
      console.error("❌ Login error:", error.code, error.message);

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
        console.warn("⚠️ Could not extract email from error");
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
          console.warn("🚨 User not found:", email);
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
          console.warn("🚨 Wrong password for:", email);
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
          console.warn("🚨 Invalid credentials");
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
          console.error("🔒 Too many requests from Firebase");
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
          console.error("🌐 Network error");
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
          console.error("⚠️ Firebase internal error:", error.message);
          return {
            success: false,
            message: "An internal error occurred. Please try again later.",
          };

        default:
          console.error("❌ Unknown error:", error.code, error.message);
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
      console.log("🔐 Logging out...");
      await signOut(authRef);
      console.log("✅ Logout successful");
      return { success: true, message: "Logged out successfully" };
    } catch (error: any) {
      console.error("❌ Logout error:", error);
      return { success: false, message: "Logout failed" };
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    const firebaseUser = authRef.currentUser;
    if (!firebaseUser) {
      console.log("No current user");
      return null;
    }

    try {
      console.log("📦 Fetching user data for:", firebaseUser.uid);
      let userDoc: any = null;
      let userRole: "student" | "guard" | "admin" | null = null;

      // Try students collection
      let docRef = doc(db, "students", firebaseUser.uid);
      let tempDoc = await getDoc(docRef);
      if (tempDoc.exists()) {
        userDoc = tempDoc;
        userRole = "student";
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
        console.warn("⚠️ User document not found in any collection:", firebaseUser.uid);
        return null;
      }

      const userData = userDoc.data();
      return {
        id: firebaseUser.uid,
        email: firebaseUser.email || "",
        name: userData.name || firebaseUser.email?.split("@")[0] || "User",
        role: userRole || userData.role || "student",
        studentId: userData.studentId || userData.employeeId,
      };
    } catch (error) {
      console.error("❌ Get current user error:", error);
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
