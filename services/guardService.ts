import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { createScanNotification } from "./notificationService";

export const processGuardEntry = async (
  data: {
    id?: string; // Pinalitan natin ng generic 'id' para pwede sa prof, staff, o student
    name?: string;
    role?: string;
    plateNumber?: string;
    vehicleType?: string;
    method: "QR" | "MANUAL";
  },
  guardId?: string
) => {
  try {
    // VALIDATION 1: I-check kung may valid ID o Plate Number na nakuha
    if (!data.id && !data.plateNumber) {
      return {
        success: false,
        message: "Invalid QR Code. Walang ID na na-detect.",
      };
    }

    // ── IDENTIFICATION: Resolve User from ID or Plate Number ──
    let vehicleType = data.vehicleType || null;
    let profileId: string | null = null;
    let resolvedId = data.id || null;
    let resolvedName = data.name || null;
    let resolvedRole = data.role || "visitor";

    if (resolvedId && data.role && ["student", "faculty", "staff"].includes(data.role)) {
      // User identified by ID (QR scan or direct lookup)
      try {
        const collectionName =
          data.role === "student" ? "students" : data.role === "faculty" ? "faculty" : "staff";
        const userDocRef = doc(db, collectionName, resolvedId);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          vehicleType = userData.vehicleType || null;
          const idFieldName =
            data.role === "student" ? "studentId" : data.role === "faculty" ? "facultyId" : "staffId";
          profileId = userData[idFieldName] || null;
          resolvedName = `${userData.firstName} ${userData.lastName}`;
          resolvedRole = data.role;
        }
      } catch (error) {
        console.error(`Error fetching ${data.role} profile:`, error);
      }
    } else if (!resolvedId && data.plateNumber && data.method === "MANUAL") {
      // Manual entry: Try to find user by plate number across all roles
      const userCollections = ["students", "faculty", "staff"];
      for (const collName of userCollections) {
        try {
          const q = query(collection(db, collName), where("vehiclePlate", "==", data.plateNumber.toUpperCase()));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            resolvedId = snapshot.docs[0].id;
            resolvedName = `${userData.firstName} ${userData.lastName}`;
            resolvedRole = collName === "students" ? "student" : collName === "faculty" ? "faculty" : "staff";
            vehicleType = userData.vehicleType || null;
            const idFieldName =
              resolvedRole === "student" ? "studentId" : resolvedRole === "faculty" ? "facultyId" : "staffId";
            profileId = userData[idFieldName] || null;
            break;
          }
        } catch (error) {
          console.error(`Error searching ${collName} by plate:`, error);
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    //dito yung sa namning ng Table sa database.
    const logsRef = collection(db, "TimeLogs");

    // Hahanapin natin kung may naka-record na siyang "IN" na hindi pa nata-timeout
    let q;
    if (data.id) {
      q = query(
        logsRef,
        where("id", "==", data.id),
        where("status", "==", "IN"),
      );
    } else if (data.plateNumber) {
      q = query(
        logsRef,
        where("plateNumber", "==", data.plateNumber),
        where("status", "==", "IN"),
      );
    }

    // Kung hindi undefined ang 'q', i-execute ang query
    if (q) {
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // MAY RECORD NA "IN" -> I-time out natin
        const existingDoc = querySnapshot.docs[0];
        const logData = existingDoc.data();

        // Check if guest pass has expired (if applicable)
        if (logData.role === "guest" && logData.expiresAt) {
          const expirationTime = logData.expiresAt.toDate();
          if (new Date() > expirationTime) {
            return {
              success: false,
              message: "Guest pass has expired (12-hour limit reached).",
            };
          }
        }

        const docRef = doc(db, "TimeLogs", existingDoc.id);

        await updateDoc(docRef, {
          timeOut: serverTimestamp(),
          status: "OUT",
        });

        // Create notification for successful timeout
        if (guardId) {
          await createScanNotification(guardId, {
            userId: resolvedId || logData.id || data.plateNumber || "Unknown",
            userName: resolvedName || logData.name || "User",
            userRole: resolvedRole || logData.role || "visitor",
            action: "TIMEOUT",
            method: data.method,
            plateNumber: data.plateNumber || null,
          });
        }

        return { success: true, action: "TIMEOUT", name: resolvedName || logData.name || "User" };
      }
    }

    // WALANG RECORD NA "IN" -> I-time in natin
    const today = new Date().toLocaleDateString("en-CA"); // Kukunin ang date ngayon format: YYYY-MM-DD

    await addDoc(logsRef, {
      id: resolvedId,
      name: resolvedName || (data.plateNumber ? `Vehicle ${data.plateNumber}` : "Unknown"),
      role: resolvedRole, // Dynamic role (student, prof, staff)
      plateNumber: data.plateNumber || null,
      vehicleType: vehicleType,
      profileId: profileId, // studentId, facultyId, staffId for easier searching
      method: data.method,
      dateString: today, // Magagamit niyo ito pang-filter sa Activity Dashboard "within the day"
      timeIn: serverTimestamp(),
      timeOut: null,
      status: "IN",
    });

    // Create notification for successful scan
    if (guardId) {
      await createScanNotification(guardId, {
        userId: resolvedId || data.plateNumber || "Unknown",
        userName: resolvedName || (data.plateNumber ? `Vehicle ${data.plateNumber}` : "User"),
        userRole: resolvedRole,
        action: "TIMEIN",
        method: data.method,
        plateNumber: data.plateNumber || null,
      });
    }

    return { success: true, action: "TIMEIN", name: resolvedName || data.plateNumber || "User" };
  } catch (error) {
    console.error("Error processing entry: ", error);
    return { success: false, message: "System error. Check connection." };
  }
};

// ════════════════════════════════════════════════════════════════════════════════
// ALGORITHM: QUICK SORT (3-Way Partition)
// ════════════════════════════════════════════════════════════════════════════════
// 
// Purpose: Sort activity logs by timestamp in descending order (latest first)
// 
// Implementation:
//  - Selects pivot element (middle of array)
//  - Partitions array into 3 groups:
//    * left: timestamps > pivot (earlier in time = come first in DESC)
//    * equal: timestamps == pivot
//    * right: timestamps < pivot (later in time)
//  - Recursively sorts left and right partitions
// 
// Time Complexity: O(n log n) average, O(n²) worst case
// Space Complexity: O(log n) for recursion stack
// Use Case: Sort guard activity logs by most recent check-in/out first
// ════════════════════════════════════════════════════════════════════════════════
function quickSortLogs(arr: any[]): any[] {
  if (arr.length <= 1) return arr;

  const pivot = arr[Math.floor(arr.length / 2)];
  const pivotTime = pivot.timeIn?.toMillis?.() || 0;

  const left: any[] = [];
  const equal: any[] = [];
  const right: any[] = [];

  for (const item of arr) {
    const itemTime = item.timeIn?.toMillis?.() || 0;
    if (itemTime > pivotTime) {
      left.push(item); // Greater timestamps go left (descending order)
    } else if (itemTime < pivotTime) {
      right.push(item);
    } else {
      equal.push(item);
    }
  }

  return [...quickSortLogs(left), ...equal, ...quickSortLogs(right)];
}

// ── Fetch Guard Activity Logs ────────────────────────────────────────────
// Fetches all documents from the "Timelogs" collection, maps them into
// an array (including doc.id), applies quickSortLogs, and returns sorted data.
export async function fetchGuardActivityLogs() {
  try {
    const logsRef = collection(db, "TimeLogs");
    const snapshot = await getDocs(logsRef);

    const logs = snapshot.docs.map((docSnap) => ({
      docId: docSnap.id,
      ...docSnap.data(),
    }));

    return quickSortLogs(logs);
  } catch (error) {
    console.error("Error fetching guard activity logs: ", error);
    return [];
  }
}

// ── Register Visitor / Guest ─────────────────────────────────────────────
// Creates a new walk-in guest record in the "Visitors" collection,
// then automatically logs a TIME-IN entry in "TimeLogs" with role "guest"
// so all guest info and time-in/time-out is tracked cleanly in one place.
export async function registerVisitor(visitorData: {
  name: string;
  purpose: string;
  plateNumber?: string;
  vehicleType?: string;
}): Promise<{ success: boolean; visitorId?: string; message?: string }> {
  try {
    // Generate a unique visitor ID: VIS- + timestamp + random suffix
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const visitorId = `VIS-${timestamp}${randomSuffix}`;

    // Calculate expiration time (12 hours from now)
    const expiresAtDate = new Date();
    expiresAtDate.setHours(expiresAtDate.getHours() + 12);
    const expiresAt = Timestamp.fromDate(expiresAtDate);

    // 1) Save to "Visitors" collection (permanent guest registry)
    const visitorsRef = collection(db, "Visitors");
    await addDoc(visitorsRef, {
      id: visitorId,
      name: visitorData.name,
      purpose: visitorData.purpose,
      plateNumber: visitorData.plateNumber || null,
      vehicleType: visitorData.vehicleType || null,
      role: "guest",
      createdAt: serverTimestamp(),
      expiresAt: expiresAt, // Guest pass valid for 12 hours
      status: "ACTIVE",
    });

    // 2) Auto TIME-IN in "TimeLogs" — all guest info stored here
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
    const logsRef = collection(db, "TimeLogs");
    await addDoc(logsRef, {
      id: visitorId,
      name: visitorData.name,
      role: "guest",
      plateNumber: visitorData.plateNumber || null,
      vehicleType: visitorData.vehicleType || null,
      purpose: visitorData.purpose,
      method: "MANUAL",
      dateString: today,
      timeIn: serverTimestamp(),
      expiresAt: expiresAt, // Store expiration in logs for quick check
      timeOut: null,
      status: "IN",
    });

    return { success: true, visitorId, expiresAt: expiresAtDate };
  } catch (error) {
    console.error("Error registering visitor: ", error);
    return { success: false, message: "Failed to register visitor. Check connection." };
  }
}
