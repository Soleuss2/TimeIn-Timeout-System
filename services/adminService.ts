import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  getAuth,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import {
  collection,
  query,
  where,
  getDoc,
  getDocs,
  doc,
  updateDoc,
  setDoc,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { authRef, db } from "./firebaseConfig";
import { SecurityService } from "./securityService";

export interface CreateAccountPayload {
  firstName: string;
  lastName: string;
  suffix?: string;
  middleName?: string;
  email: string;
  role: "student" | "faculty" | "staff" | "guard";
  studentId?: string;
  employeeId?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  shift?: string;
}

export interface AdminAccountResponse {
  success: boolean;
  message: string;
  userId?: string;
  error?: string;
}

export interface DirectoryUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  role: "student" | "faculty" | "staff" | "guard";
  studentId?: string;
  employeeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  plate: string;
  type: "time_in" | "time_out";
  name: string;
  role: "student" | "guard" | "visitor";
  time: string;
  timestamp: Date;
  guardRef?: string;
  studentRef?: string;
  vehicleType?: string;
  status?: string;
}

export interface ParkingHourData {
  hour: string;
  count: number;
  height: number;
}

// Helper to generate secure temporary password
const generateTemporaryPassword = (): string => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%^&*";

  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  const allChars = uppercase + lowercase + numbers + special;
  for (let i = password.length; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

/**
 * Creates a secondary Firebase Auth instance so that
 * createUserWithEmailAndPassword does NOT replace the admin's session.
 */
const createUserWithSecondaryApp = async (
  email: string,
  password: string,
): Promise<FirebaseUser> => {
  // Build a unique name so we don't collide with existing apps
  const secondaryAppName = `admin-create-${Date.now()}`;

  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password,
    );
    const newUser = userCredential.user;

    // Send verification email from the secondary auth context
    await sendEmailVerification(newUser);

    // Sign out from secondary so it doesn't linger
    await signOut(secondaryAuth);

    return newUser;
  } finally {
    // Always clean up the secondary app
    await deleteApp(secondaryApp);
  }
};

/**
 * Extract user ID from Firestore document reference string
 * Converts "/guards/ABC123" or "/students/XYZ789" to "ABC123" or "XYZ789"
 */
const extractRefId = (ref: string | undefined): string | null => {
  if (!ref) return null;
  try {
    const parts = ref.replace(/^\//, "").split("/");
    return parts.length >= 2 ? parts[1] : null;
  } catch {
    return null;
  }
};

export const AdminService = {
  /**
   * Verify admin privileges - Check if user is admin
   */
  verifyAdminPrivileges: async (adminId: string): Promise<boolean> => {
    try {
      // Look up admin by document ID (the Firebase UID is used as the doc ID,
      // consistent with how authService retrieves admin profiles)
      const adminDocRef = doc(db, "admins", adminId);
      const adminDocSnap = await getDoc(adminDocRef);

      if (!adminDocSnap.exists()) {
        await SecurityService.logSecurityEvent({
          type: "UNAUTHORIZED_ADMIN_ACCESS",
          userId: adminId,
          details: "Non-admin attempted admin operation",
        });
        return false;
      }

      const adminData = adminDocSnap.data();
      if (adminData.isActive === false) {
        await SecurityService.logSecurityEvent({
          type: "INACTIVE_ADMIN_ACCESS",
          userId: adminId,
          details: "Inactive admin attempted operation",
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error verifying admin privileges:", error);
      return false;
    }
  },

  /**
   * Check if admin has rate-limited account creation
   */
  checkAdminRateLimit: async (adminId: string): Promise<boolean> => {
    try {
      const rateLimitKey = `admin_creation_${adminId}`;
      const storedLimit = await SecurityService.getSecurityData(rateLimitKey);

      if (!storedLimit) {
        // Initialize rate limit: 10 accounts per hour
        await SecurityService.setSecurityData(rateLimitKey, "1");
        return true;
      }

      const count = parseInt(storedLimit);
      if (count >= 10) {
        await SecurityService.logSecurityEvent({
          type: "ADMIN_RATE_LIMIT_EXCEEDED",
          adminId,
          details: "Admin exceeded account creation limit",
        });
        return false;
      }

      await SecurityService.setSecurityData(
        rateLimitKey,
        (count + 1).toString(),
      );
      return true;
    } catch (error) {
      console.error("Error checking admin rate limit:", error);
      return false;
    }
  },

  /**
   * Create a new student account with email verification
   */
  createStudentAccount: async (
    payload: CreateAccountPayload & { adminId: string },
  ): Promise<AdminAccountResponse> => {
    try {
      // Verify admin privileges
      const isAdmin = await AdminService.verifyAdminPrivileges(payload.adminId);
      if (!isAdmin) {
        return {
          success: false,
          message: "Unauthorized. Admin privileges required.",
          error: "ADMIN_VERIFICATION_FAILED",
        };
      }

      // Check rate limit
      const withinLimit = await AdminService.checkAdminRateLimit(
        payload.adminId,
      );
      if (!withinLimit) {
        return {
          success: false,
          message: "Rate limit exceeded. Maximum 10 accounts per hour allowed.",
          error: "RATE_LIMIT_EXCEEDED",
        };
      }

      // Validate inputs
      if (
        !payload.firstName ||
        !payload.lastName ||
        !payload.email ||
        !payload.studentId
      ) {
        return {
          success: false,
          message: "Missing required fields",
          error: "INVALID_INPUT",
        };
      }

      // Validate email format
      if (!SecurityService.validateEmail(payload.email)) {
        return {
          success: false,
          message: "Invalid email format",
          error: "INVALID_EMAIL",
        };
      }

      // Check if email already exists
      const existingStudent = await getDocs(
        query(collection(db, "students"), where("email", "==", payload.email)),
      );

      if (!existingStudent.empty) {
        return {
          success: false,
          message: "Email already registered",
          error: "EMAIL_EXISTS",
        };
      }

      // Generate temporary password
      const tempPassword = generateTemporaryPassword();

      // Create Firebase Auth user using a SECONDARY app so the
      // admin's session is NOT replaced.
      let firebaseUser: FirebaseUser;
      try {
        firebaseUser = await createUserWithSecondaryApp(
          payload.email,
          tempPassword,
        );
      } catch (error: any) {
        if (error.code === "auth/email-already-in-use") {
          return {
            success: false,
            message: "Email already registered in system",
            error: "EMAIL_IN_USE",
          };
        }
        throw error;
      }

      // Create student document in Firestore with isActive: false
      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      const studentData = {
        uid: firebaseUser.uid,
        firstName: payload.firstName,
        lastName: payload.lastName,
        name: fullName,
        middleName: payload.middleName || "",
        email: payload.email,
        studentId: payload.studentId,
        role: "student",
        vehicleType: payload.vehicleType || "car",
        plateNumber: payload.vehiclePlate || "",
        suffix: payload.suffix || "",
        isActive: false, // Account not active until email verified
        emailVerified: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: payload.adminId,
        accountStatus: "PENDING_EMAIL_VERIFICATION",
      };

      await setDoc(doc(db, "students", firebaseUser.uid), studentData);

      // Generate QR code data for guard scanning
      const qrData = JSON.stringify({
        type: "student_qr",
        studentId: payload.studentId,
        uid: firebaseUser.uid,
        name: fullName,
        email: payload.email,
        plateNumber: payload.vehiclePlate || "",
        vehicleType: payload.vehicleType || "car",
      });

      // Store QR code document in qr_codes collection
      await setDoc(doc(db, "qr_codes", firebaseUser.uid), {
        qrData,
        studentRef: `/students/${firebaseUser.uid}`,
        studentId: payload.studentId,
        studentName: fullName,
        plateNumber: payload.vehiclePlate || "",
        vehicleType: payload.vehicleType || "car",
        isActive: false, // Activated when student verifies email
        createdAt: Timestamp.now(),
        createdBy: payload.adminId,
      });

      // Send password reset email from the PRIMARY auth instance
      // (secondary app is already destroyed, so we use the main one)
      try {
        await sendPasswordResetEmail(authRef, payload.email);
      } catch (resetError) {
        console.error("Error sending password reset email:", resetError);
        // Continue — verification email was already sent
      }

      // Log security event
      await SecurityService.logSecurityEvent({
        type: "ACCOUNT_CREATED",
        email: payload.email,
        role: "student",
        adminId: payload.adminId,
        studentId: payload.studentId,
      });

      return {
        success: true,
        message:
          "Student account created. Verification & password reset emails sent.",
        userId: firebaseUser.uid,
      };
    } catch (error: any) {
      console.error("Error creating student account:", error);

      await SecurityService.logSecurityEvent({
        type: "ACCOUNT_CREATION_FAILED",
        role: "student",
        adminId: payload.adminId,
        error: error.message,
      });

      return {
        success: false,
        message: "Failed to create student account",
        error: error.message,
      };
    }
  },

  /**
   * Create a new guard account with email verification
   */
  createGuardAccount: async (
    payload: CreateAccountPayload & { adminId: string },
  ): Promise<AdminAccountResponse> => {
    try {
      // Verify admin privileges
      const isAdmin = await AdminService.verifyAdminPrivileges(payload.adminId);
      if (!isAdmin) {
        return {
          success: false,
          message: "Unauthorized. Admin privileges required.",
          error: "ADMIN_VERIFICATION_FAILED",
        };
      }

      // Check rate limit
      const withinLimit = await AdminService.checkAdminRateLimit(
        payload.adminId,
      );
      if (!withinLimit) {
        return {
          success: false,
          message: "Rate limit exceeded. Maximum 10 accounts per hour allowed.",
          error: "RATE_LIMIT_EXCEEDED",
        };
      }

      // Validate inputs
      if (
        !payload.firstName ||
        !payload.lastName ||
        !payload.email ||
        !payload.employeeId
      ) {
        return {
          success: false,
          message: "Missing required fields",
          error: "INVALID_INPUT",
        };
      }

      // Validate email format
      if (!SecurityService.validateEmail(payload.email)) {
        return {
          success: false,
          message: "Invalid email format",
          error: "INVALID_EMAIL",
        };
      }

      // Check if email already exists
      const existingGuard = await getDocs(
        query(collection(db, "guards"), where("email", "==", payload.email)),
      );

      if (!existingGuard.empty) {
        return {
          success: false,
          message: "Email already registered",
          error: "EMAIL_EXISTS",
        };
      }

      // Generate temporary password
      const tempPassword = generateTemporaryPassword();

      // Create Firebase Auth user using a SECONDARY app so the
      // admin's session is NOT replaced.
      let firebaseUser: FirebaseUser;
      try {
        firebaseUser = await createUserWithSecondaryApp(
          payload.email,
          tempPassword,
        );
      } catch (error: any) {
        if (error.code === "auth/email-already-in-use") {
          return {
            success: false,
            message: "Email already registered in system",
            error: "EMAIL_IN_USE",
          };
        }
        throw error;
      }

      // Create guard document in Firestore with isActive: false
      const guardFullName = `${payload.firstName} ${payload.lastName}`.trim();
      const guardData = {
        uid: firebaseUser.uid,
        firstName: payload.firstName,
        lastName: payload.lastName,
        name: guardFullName,
        middleName: payload.middleName || "",
        email: payload.email,
        employeeId: payload.employeeId,
        role: "guard",
        shift: payload.shift || "",
        suffix: payload.suffix || "",
        isActive: false, // Account not active until email verified
        emailVerified: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: payload.adminId,
        accountStatus: "PENDING_EMAIL_VERIFICATION",
      };

      await setDoc(doc(db, "guards", firebaseUser.uid), guardData);

      // Send password reset email from the PRIMARY auth instance
      try {
        await sendPasswordResetEmail(authRef, payload.email);
      } catch (resetError) {
        console.error("Error sending password reset email:", resetError);
      }

      // Log security event
      await SecurityService.logSecurityEvent({
        type: "ACCOUNT_CREATED",
        email: payload.email,
        role: "guard",
        adminId: payload.adminId,
        employeeId: payload.employeeId,
      });

      return {
        success: true,
        message:
          "Guard account created. Verification & password reset emails sent.",
        userId: firebaseUser.uid,
      };
    } catch (error: any) {
      console.error("Error creating guard account:", error);

      await SecurityService.logSecurityEvent({
        type: "ACCOUNT_CREATION_FAILED",
        role: "guard",
        adminId: payload.adminId,
        error: error.message,
      });

      return {
        success: false,
        message: "Failed to create guard account",
        error: error.message,
      };
    }
  },

  /**
   * Create a new faculty or staff account with email verification
   */
  createFacultyStaffAccount: async (
    payload: CreateAccountPayload & { adminId: string },
  ): Promise<AdminAccountResponse> => {
    try {
      // Verify admin privileges
      const isAdmin = await AdminService.verifyAdminPrivileges(payload.adminId);
      if (!isAdmin) {
        return {
          success: false,
          message: "Unauthorized. Admin privileges required.",
          error: "ADMIN_VERIFICATION_FAILED",
        };
      }

      // Check rate limit
      const withinLimit = await AdminService.checkAdminRateLimit(
        payload.adminId,
      );
      if (!withinLimit) {
        return {
          success: false,
          message: "Rate limit exceeded. Maximum 10 accounts per hour allowed.",
          error: "RATE_LIMIT_EXCEEDED",
        };
      }

      // Validate inputs
      if (
        !payload.firstName ||
        !payload.lastName ||
        !payload.email ||
        !payload.employeeId
      ) {
        return {
          success: false,
          message: "Missing required fields",
          error: "INVALID_INPUT",
        };
      }

      // Validate email format
      if (!SecurityService.validateEmail(payload.email)) {
        return {
          success: false,
          message: "Invalid email format",
          error: "INVALID_EMAIL",
        };
      }

      // Check if email already exists in both faculty and staff collections
      const existingUser = await getDocs(
        query(
          collection(db, payload.role === "faculty" ? "faculty" : "staff"),
          where("email", "==", payload.email),
        ),
      );

      if (!existingUser.empty) {
        return {
          success: false,
          message: "Email already registered",
          error: "EMAIL_EXISTS",
        };
      }

      // Generate temporary password
      const tempPassword = generateTemporaryPassword();

      // Create Firebase Auth user using a SECONDARY app
      let firebaseUser: FirebaseUser;
      try {
        firebaseUser = await createUserWithSecondaryApp(
          payload.email,
          tempPassword,
        );
      } catch (error: any) {
        if (error.code === "auth/email-already-in-use") {
          return {
            success: false,
            message: "Email already registered in system",
            error: "EMAIL_IN_USE",
          };
        }
        throw error;
      }

      // Create faculty/staff document in Firestore
      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      const accountData = {
        uid: firebaseUser.uid,
        firstName: payload.firstName,
        lastName: payload.lastName,
        name: fullName,
        middleName: payload.middleName || "",
        email: payload.email,
        employeeId: payload.employeeId,
        role: payload.role,
        vehicleType: payload.vehicleType || "car",
        plateNumber: payload.vehiclePlate || "",
        suffix: payload.suffix || "",
        isActive: false,
        emailVerified: false,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: payload.adminId,
        accountStatus: "PENDING_EMAIL_VERIFICATION",
      };

      const collectionName = payload.role === "faculty" ? "faculty" : "staff";
      await setDoc(doc(db, collectionName, firebaseUser.uid), accountData);

      // Generate QR code data for guard scanning
      const qrData = JSON.stringify({
        type: `${payload.role}_qr`,
        employeeId: payload.employeeId,
        uid: firebaseUser.uid,
        name: fullName,
        email: payload.email,
        plateNumber: payload.vehiclePlate || "",
        vehicleType: payload.vehicleType || "car",
      });

      // Store QR code document
      await setDoc(doc(db, "qr_codes", firebaseUser.uid), {
        qrData,
        [`${payload.role}Ref`]: `/${collectionName}/${firebaseUser.uid}`,
        employeeId: payload.employeeId,
        [`${payload.role}Name`]: fullName,
        plateNumber: payload.vehiclePlate || "",
        vehicleType: payload.vehicleType || "car",
        isActive: false,
        createdAt: Timestamp.now(),
        createdBy: payload.adminId,
      });

      // Send password reset email
      try {
        await sendPasswordResetEmail(authRef, payload.email);
      } catch (resetError) {
        console.error("Error sending password reset email:", resetError);
      }

      // Log security event
      await SecurityService.logSecurityEvent({
        type: "ACCOUNT_CREATED",
        email: payload.email,
        role: payload.role,
        adminId: payload.adminId,
        employeeId: payload.employeeId,
      });

      const roleLabel = payload.role === "faculty" ? "Faculty" : "Staff";
      return {
        success: true,
        message: `${roleLabel} account created. Verification & password reset emails sent.`,
        userId: firebaseUser.uid,
      };
    } catch (error: any) {
      console.error("Error creating faculty/staff account:", error);

      await SecurityService.logSecurityEvent({
        type: "ACCOUNT_CREATION_FAILED",
        role: payload.role,
        adminId: payload.adminId,
        error: error.message,
      });

      return {
        success: false,
        message: `Failed to create ${payload.role} account`,
        error: error.message,
      };
    }
  },

  /**
   * Fetch all students for directory
   */
  fetchStudents: async (searchQuery = ""): Promise<DirectoryUser[]> => {
    try {
      const studentsRef = collection(db, "students");
      const snapshot = await getDocs(studentsRef);

      let students: DirectoryUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          id: doc.id,
          firstName: data.firstName || data.FirstName || "",
          lastName: data.lastName || data.lastNameName || "",
          email: data.email || "",
          isActive: data.isActive || false,
          role: "student",
          studentId: data.studentId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        students = students.filter(
          (s) =>
            s.firstName.toLowerCase().includes(query) ||
            s.lastName.toLowerCase().includes(query) ||
            s.studentId?.toLowerCase().includes(query) ||
            s.email.toLowerCase().includes(query),
        );
      }

      return students;
    } catch (error) {
      console.error("Error fetching students:", error);
      return [];
    }
  },

  /**
   * Fetch all faculty for directory
   */
  fetchFaculty: async (searchQuery = ""): Promise<DirectoryUser[]> => {
    try {
      const facultyRef = collection(db, "faculty");
      const snapshot = await getDocs(facultyRef);

      let facultyList: DirectoryUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        facultyList.push({
          id: doc.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          isActive: data.isActive || false,
          role: "faculty",
          employeeId: data.employeeId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        facultyList = facultyList.filter(
          (f) =>
            f.firstName.toLowerCase().includes(query) ||
            f.lastName.toLowerCase().includes(query) ||
            f.employeeId?.toLowerCase().includes(query) ||
            f.email.toLowerCase().includes(query),
        );
      }

      return facultyList;
    } catch (error) {
      console.error("Error fetching faculty:", error);
      return [];
    }
  },

  /**
   * Fetch all staff for directory
   */
  fetchStaff: async (searchQuery = ""): Promise<DirectoryUser[]> => {
    try {
      const staffRef = collection(db, "staff");
      const snapshot = await getDocs(staffRef);

      let staffList: DirectoryUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        staffList.push({
          id: doc.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          isActive: data.isActive || false,
          role: "staff",
          employeeId: data.employeeId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        staffList = staffList.filter(
          (s) =>
            s.firstName.toLowerCase().includes(query) ||
            s.lastName.toLowerCase().includes(query) ||
            s.employeeId?.toLowerCase().includes(query) ||
            s.email.toLowerCase().includes(query),
        );
      }

      return staffList;
    } catch (error) {
      console.error("Error fetching staff:", error);
      return [];
    }
  },

  /**
   * Fetch all guards for directory
   */
  fetchGuards: async (searchQuery = ""): Promise<DirectoryUser[]> => {
    try {
      const guardsRef = collection(db, "guards");
      const snapshot = await getDocs(guardsRef);

      let guards: DirectoryUser[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        guards.push({
          id: doc.id,
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          email: data.email || "",
          isActive: data.isActive || false,
          role: "guard",
          employeeId: data.employeeId,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        guards = guards.filter(
          (g) =>
            g.firstName.toLowerCase().includes(query) ||
            g.lastName.toLowerCase().includes(query) ||
            g.employeeId?.toLowerCase().includes(query) ||
            g.email.toLowerCase().includes(query),
        );
      }

      return guards;
    } catch (error) {
      console.error("Error fetching guards:", error);
      return [];
    }
  },

  /**
   * Deactivate a user account (soft delete)
   */
  deactivateUser: async (
    userId: string,
    role: "student" | "guard",
    adminId: string,
  ): Promise<AdminAccountResponse> => {
    try {
      // Verify admin privileges
      const isAdmin = await AdminService.verifyAdminPrivileges(adminId);
      if (!isAdmin) {
        return {
          success: false,
          message: "Unauthorized. Admin privileges required.",
          error: "ADMIN_VERIFICATION_FAILED",
        };
      }

      const collection_name = role === "student" ? "students" : "guards";
      const userRef = doc(db, collection_name, userId);

      await updateDoc(userRef, {
        isActive: false,
        updatedAt: Timestamp.now(),
        deactivatedBy: adminId,
      });

      await SecurityService.logSecurityEvent({
        type: "USER_DEACTIVATED",
        userId,
        role,
        adminId,
      });

      return {
        success: true,
        message: "User account deactivated successfully",
      };
    } catch (error: any) {
      console.error("Error deactivating user:", error);
      return {
        success: false,
        message: "Failed to deactivate user account",
        error: error.message,
      };
    }
  },

  /**
   * Fetch audit logs from TimeLogs collection for a specific date range
   * Properly handles Firestore references and date filtering
   */
  fetchAuditLogs: async (
    dateFrom?: Date,
    dateTo?: Date,
    searchQuery?: string,
  ): Promise<AuditLog[]> => {
    try {
      const timeLogsRef = collection(db, "TimeLogs");
      
      // Build date range queries if dates provided
      let constraints: any[] = [];
      
      if (dateFrom) {
        constraints.push(where("time_in", ">=", dateFrom));
      }
      
      if (dateTo) {
        // Add 1 day to include all events on the "to" date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        constraints.push(where("time_in", "<", endDate));
      }
      
      constraints.push(orderBy("time_in", "desc"));
      
      const q = query(timeLogsRef, ...constraints);
      const logsSnapshot = await getDocs(q);
      
      const allEvents: AuditLog[] = [];
      const userCache = new Map<string, { name: string; role: "student" | "guard" }>();

      for (const logDoc of logsSnapshot.docs) {
        const data = logDoc.data();
        const plateNumber = data.plateNumber || "N/A";
        const vehicleType = data.vehicleType || "car";
        const status = data.status || "pending";
        
        // Validate required fields
        if (!data.time_in) continue;

        // Determine who made the entry (student or guard)
        let name = "Unknown";
        let role: "student" | "guard" | "visitor" = "visitor";
        const userRefId = extractRefId(data.studentRef) || 
                         extractRefId(data.guardRef);
        const isStudent = !!data.studentRef;

        // Try to get cached user data first
        if (userRefId && userCache.has(userRefId)) {
          const cached = userCache.get(userRefId)!;
          name = cached.name;
          role = cached.role;
        } else if (userRefId) {
          try {
            const userCollection = isStudent ? "students" : "guards";
            const userDoc = await getDoc(doc(db, userCollection, userRefId));
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              role = isStudent ? "student" : "guard";
              
              // Handle different naming conventions
              const firstName = userData.firstName || userData.FirstName || "";
              const lastName = userData.lastName || userData.lastNameName || "";
              name = `${firstName} ${lastName}`.trim() || "Unknown";
              
              // Cache the result
              userCache.set(userRefId, { name, role });
            }
          } catch (e) {
            console.error(`Error fetching ${isStudent ? "student" : "guard"} data:`, e);
          }
        }

        // Create individual audit entries for IN and OUT if they exist
        // Handle Time In
        if (data.time_in) {
          const timestamp = data.time_in.toDate
            ? data.time_in.toDate()
            : new Date(data.time_in);
          
          const timeString = timestamp.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          
          const dateString = timestamp.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          allEvents.push({
            id: `${logDoc.id}_in`,
            plate: plateNumber,
            type: "time_in",
            name,
            role,
            time: `${timeString} • ${dateString}`,
            timestamp,
            guardRef: data.guardRef,
            studentRef: data.studentRef,
            vehicleType,
            status: "check_in",
          });
        }

        // Handle Time Out
        if (data.time_out) {
          const timestamp = data.time_out.toDate
            ? data.time_out.toDate()
            : new Date(data.time_out);
          
          const timeString = timestamp.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });
          
          const dateString = timestamp.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });

          allEvents.push({
            id: `${logDoc.id}_out`,
            plate: plateNumber,
            type: "time_out",
            name,
            role,
            time: `${timeString} • ${dateString}`,
            timestamp,
            guardRef: data.guardRef,
            studentRef: data.studentRef,
            vehicleType,
            status: status === "completed" ? "check_out" : "pending",
          });
        }
      }

      // Sort all combined events by timestamp descending
      allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Filter by search query
      return allEvents.filter((log) => {
        const matchesSearch =
          !searchQuery ||
          log.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          log.role.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesSearch;
      });
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      return [];
    }
  },

  /**
   * Get today's vehicle count
   */
  getTodayVehicleCount: async (): Promise<number> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const timeLogsRef = collection(db, "TimeLogs");
      const q = query(
        timeLogsRef,
        where("time_in", ">=", Timestamp.fromDate(today)),
        where("time_in", "<", Timestamp.fromDate(tomorrow)),
      );

      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error("Error getting vehicle count:", error);
      return 0;
    }
  },

  /**
   * Get parking hours data for today (vehicle entries per hour)
   */
  getParkingHoursData: async (): Promise<ParkingHourData[]> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const timeLogsRef = collection(db, "TimeLogs");
      const q = query(
        timeLogsRef,
        where("time_in", ">=", Timestamp.fromDate(today)),
        where("time_in", "<", Timestamp.fromDate(tomorrow)),
        orderBy("time_in", "asc"),
      );

      const snapshot = await getDocs(q);

      // Initialize hour counts (0-23)
      const hourCounts: { [key: number]: number } = {};
      for (let i = 0; i < 24; i++) {
        hourCounts[i] = 0;
      }

      // Count entries per hour
      snapshot.forEach((doc) => {
        const timestamp = doc.data().time_in?.toDate();
        if (timestamp) {
          const hour = timestamp.getHours();
          hourCounts[hour]++;
        }
      });

      // Convert to array format with calculated heights (max 100)
      const maxCount = Math.max(...Object.values(hourCounts), 1);
      const hoursData: ParkingHourData[] = [];

      // Show key hours (6 AM - 6 PM)
      const displayHours = [6, 9, 12, 15, 18];
      for (const hour of displayHours) {
        const count = hourCounts[hour] || 0;
        const height = (count / maxCount) * 100;

        hoursData.push({
          hour: `${hour}:00`,
          count,
          height: Math.max(height, 20), // Minimum visible height
        });
      }

      return hoursData;
    } catch (error) {
      console.error("Error getting parking hours data:", error);
      return [];
    }
  },
};
