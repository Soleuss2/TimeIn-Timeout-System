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

    // ── Fetch vehicle type from student/faculty/staff profile if ID exists ──
    let vehicleType = data.vehicleType || null;
    let profileId: string | null = null; // studentId, facultyId, staffId, etc.
    if (data.id && data.role && ["student", "faculty", "staff"].includes(data.role)) {
      try {
        const collectionName =
          data.role === "student"
            ? "students"
            : data.role === "faculty"
              ? "faculty"
              : "staff";
        const userDocRef = doc(db, collectionName, data.id);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          vehicleType = userDoc.data().vehicleType || null;
          // Extract profile-specific ID (studentId, facultyId, staffId)
          const idFieldName =
            data.role === "student"
              ? "studentId"
              : data.role === "faculty"
                ? "facultyId"
                : "staffId";
          profileId = userDoc.data()[idFieldName] || null;
        }
      } catch (error) {
        console.error(`Error fetching ${data.role} profile:`, error);
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
        const docRef = doc(db, "TimeLogs", existingDoc.id);

        await updateDoc(docRef, {
          timeOut: serverTimestamp(),
          status: "OUT",
        });

        // Create notification for successful scan
        if (guardId) {
          await createScanNotification(guardId, {
            userId: data.id || data.plateNumber || "Unknown",
            userName: data.name || "User",
            userRole: data.role || "visitor",
            action: "TIMEOUT",
            method: data.method,
            plateNumber: data.plateNumber || null,
          });
        }

        return { success: true, action: "TIMEOUT", name: data.name || "User" };
      }
    }

    // WALANG RECORD NA "IN" -> I-time in natin
    const today = new Date().toLocaleDateString("en-CA"); // Kukunin ang date ngayon format: YYYY-MM-DD

    await addDoc(logsRef, {
      id: data.id || null,
      name: data.name || "Unknown",
      role: data.role || "visitor", // Dynamic role (student, prof, staff)
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
        userId: data.id || data.plateNumber || "Unknown",
        userName: data.name || "User",
        userRole: data.role || "visitor",
        action: "TIMEIN",
        method: data.method,
        plateNumber: data.plateNumber || null,
      });
    }

    return { success: true, action: "TIMEIN", name: data.name || "User" };
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
      timeOut: null,
      status: "IN",
    });

    return { success: true, visitorId };
  } catch (error) {
    console.error("Error registering visitor: ", error);
    return { success: false, message: "Failed to register visitor. Check connection." };
  }
}
