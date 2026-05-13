/**
 * Validation Service
 * Centralized validation functions for ID formats, plate numbers, and other user data
 * Uses algorithms from the TIME IN/OUT system specification
 */

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates Student ID format: XX-XXXX (e.g., 23-1832)
 * @param studentId - Student ID to validate
 * @returns ValidationResult with validity status and message
 */
export function validateStudentId(studentId: string): ValidationResult {
  if (!studentId || !studentId.trim()) {
    return { valid: false, message: "Student ID is required" };
  }

  const studentIdRegex = /^\d{2}-\d{4}$/;
  if (!studentIdRegex.test(studentId)) {
    return {
      valid: false,
      message: "Student ID must be in format XX-XXXX (e.g., 23-1832)",
    };
  }

  return { valid: true };
}

/**
 * Validates Faculty ID format: FAC-XXXX (e.g., FAC-1234)
 * @param employeeId - Employee ID to validate
 * @returns ValidationResult with validity status and message
 */
export function validateFacultyId(employeeId: string): ValidationResult {
  if (!employeeId || !employeeId.trim()) {
    return { valid: false, message: "Faculty ID is required" };
  }

  const employeeIdRegex = /^FAC-\d{4}$/;
  if (!employeeIdRegex.test(employeeId)) {
    return {
      valid: false,
      message: "Faculty ID must be in format FAC-0000 (e.g., FAC-1234)",
    };
  }

  return { valid: true };
}

/**
 * Validates Staff ID format: STF-XXXX (e.g., STF-1234)
 * @param employeeId - Employee ID to validate
 * @returns ValidationResult with validity status and message
 */
export function validateStaffId(employeeId: string): ValidationResult {
  if (!employeeId || !employeeId.trim()) {
    return { valid: false, message: "Staff ID is required" };
  }

  const employeeIdRegex = /^STF-\d{4}$/;
  if (!employeeIdRegex.test(employeeId)) {
    return {
      valid: false,
      message: "Staff ID must be in format STF-0000 (e.g., STF-1234)",
    };
  }

  return { valid: true };
}

/**
 * Validates Guard ID format: GRD-XXXX (e.g., GRD-1234)
 * @param employeeId - Employee ID to validate
 * @returns ValidationResult with validity status and message
 */
export function validateGuardId(employeeId: string): ValidationResult {
  if (!employeeId || !employeeId.trim()) {
    return { valid: false, message: "Guard ID is required" };
  }

  const employeeIdRegex = /^GRD-\d{4}$/;
  if (!employeeIdRegex.test(employeeId)) {
    return {
      valid: false,
      message: "Guard ID must be in format GRD-0000 (e.g., GRD-1234)",
    };
  }

  return { valid: true };
}

/**
 * Validates generic Employee ID format: XXX-XXXX (3 letters + 4 digits)
 * Checks for proper role prefix (FAC, STF, GRD)
 * @param employeeId - Employee ID to validate
 * @param role - Role to validate against (faculty, staff, guard)
 * @returns ValidationResult with validity status and message
 */
export function validateEmployeeId(
  employeeId: string,
  role: "faculty" | "staff" | "guard"
): ValidationResult {
  if (!employeeId || !employeeId.trim()) {
    return { valid: false, message: "Employee ID is required" };
  }

  const employeeIdRegex = /^[A-Z]{3}-\d{4}$/;
  if (!employeeIdRegex.test(employeeId)) {
    const rolePrefix =
      role === "faculty" ? "FAC" : role === "staff" ? "STF" : "GRD";
    return {
      valid: false,
      message: `Employee ID must be in format ${rolePrefix}-0000 (e.g., ${rolePrefix}-1234)`,
    };
  }

  // Validate the prefix matches the role
  const actualPrefix = employeeId.split("-")[0];
  const expectedPrefix =
    role === "faculty" ? "FAC" : role === "staff" ? "STF" : "GRD";

  if (actualPrefix !== expectedPrefix) {
    return {
      valid: false,
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} Employee ID must start with ${expectedPrefix}`,
    };
  }

  return { valid: true };
}

/**
 * Validates plate number format: NUM XXXX
 * Supports formats for cars and motorcycles
 * E-bikes do NOT need plate numbers
 * Examples: ABC 1234 (3 letters + space + 4 numbers)
 * @param platNumber - Plate number to validate
 * @param vehicleType - Type of vehicle (Car, Motorcycle, Ebike, Others)
 * @returns ValidationResult with validity status and message
 */
export function validatePlateNumber(
  platNumber: string,
  vehicleType?: string
): ValidationResult {
  // E-bikes don't need plate numbers
  if (vehicleType === "Ebike") {
    return { valid: true };
  }

  // If no plate number provided and it's not an ebike
  if (!platNumber || !platNumber.trim()) {
    if (vehicleType === "Car" || vehicleType === "Motorcycle") {
      return {
        valid: false,
        message: `${vehicleType} requires a plate number in format ABC 1234`,
      };
    }
    // Optional for other types
    return { valid: true };
  }

  // Validate format: 3 letters + space + 4 numbers
  const plateRegex = /^[A-Z]{3}\s?\d{4}$/;
  if (!plateRegex.test(platNumber)) {
    return {
      valid: false,
      message: "Vehicle plate must be in format ABC 1234 (3 letters + 4 numbers)",
    };
  }

  return { valid: true };
}

/**
 * Validates email format
 * Must be a Gmail address (@gmail.com)
 * @param email - Email to validate
 * @returns ValidationResult with validity status and message
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || !email.trim()) {
    return { valid: false, message: "Email is required" };
  }

  if (!email.toLowerCase().endsWith("@gmail.com")) {
    return {
      valid: false,
      message: "Email must be a Gmail address (e.g., name@gmail.com)",
    };
  }

  return { valid: true };
}

/**
 * Validates name (first name, last name, etc.)
 * @param name - Name to validate
 * @param fieldName - Name of the field (for error message)
 * @returns ValidationResult with validity status and message
 */
export function validateName(name: string, fieldName: string = "Name"): ValidationResult {
  if (!name || !name.trim()) {
    return { valid: false, message: `${fieldName} is required` };
  }

  return { valid: true };
}

/**
 * Validates vehicle type
 * @param vehicleType - Vehicle type to validate
 * @param platNumber - Plate number (if provided)
 * @returns ValidationResult with validity status and message
 */
export function validateVehicleType(
  vehicleType: string,
  platNumber?: string
): ValidationResult {
  if (!vehicleType) {
    if (platNumber && platNumber.trim()) {
      return {
        valid: false,
        message: "Vehicle type is required when a plate number is provided",
      };
    }
    // Vehicle type is optional if no plate
    return { valid: true };
  }

  const validTypes = ["Car", "Motorcycle", "Ebike", "Others"];
  if (!validTypes.includes(vehicleType)) {
    return {
      valid: false,
      message: `Vehicle type must be one of: ${validTypes.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Comprehensive account creation validation
 * @param data - Account data to validate
 * @returns ValidationResult with validity status and message
 */
export function validateAccountCreation(data: {
  firstName: string;
  lastName: string;
  email: string;
  role: "student" | "faculty" | "staff" | "guard";
  studentId?: string;
  employeeId?: string;
  vehiclePlate?: string;
  vehicleType?: string;
}): ValidationResult {
  // Validate names
  let result = validateName(data.firstName, "First name");
  if (!result.valid) return result;

  result = validateName(data.lastName, "Last name");
  if (!result.valid) return result;

  // Validate email
  result = validateEmail(data.email);
  if (!result.valid) return result;

  // Role-specific validation
  if (data.role === "student") {
    result = validateStudentId(data.studentId || "");
    if (!result.valid) return result;

    result = validateVehicleType(data.vehicleType || "", data.vehiclePlate);
    if (!result.valid) return result;

    if (data.vehiclePlate && data.vehiclePlate.trim()) {
      result = validatePlateNumber(data.vehiclePlate, data.vehicleType);
      if (!result.valid) return result;
    }
  } else if (data.role === "faculty") {
    result = validateFacultyId(data.employeeId || "");
    if (!result.valid) return result;
  } else if (data.role === "staff") {
    result = validateStaffId(data.employeeId || "");
    if (!result.valid) return result;
  } else if (data.role === "guard") {
    result = validateGuardId(data.employeeId || "");
    if (!result.valid) return result;
  }

  return { valid: true };
}
