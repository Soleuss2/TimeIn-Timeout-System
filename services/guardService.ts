import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebaseConfig"; //

export const processGuardEntry = async (data: {
  id?: string; // Pinalitan natin ng generic 'id' para pwede sa prof, staff, o student
  name?: string;
  role?: string;
  plateNumber?: string;
  method: "QR" | "MANUAL";
}) => {
  try {
    // VALIDATION 1: I-check kung may valid ID o Plate Number na nakuha
    if (!data.id && !data.plateNumber) {
      return {
        success: false,
        message: "Invalid QR Code. Walang ID na na-detect.",
      };
    }

    const logsRef = collection(db, "activity_logs");

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
        const docRef = doc(db, "activity_logs", existingDoc.id);

        await updateDoc(docRef, {
          timeOut: serverTimestamp(),
          status: "OUT",
        });

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
      method: data.method,
      dateString: today, // Magagamit niyo ito pang-filter sa Activity Dashboard "within the day"
      timeIn: serverTimestamp(),
      timeOut: null,
      status: "IN",
    });

    return { success: true, action: "TIMEIN", name: data.name || "User" };
  } catch (error) {
    console.error("Error processing entry: ", error);
    return { success: false, message: "System error. Check connection." };
  }
};
    