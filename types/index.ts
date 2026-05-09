export type UserRole = "student" | "guard" | "admin";

export type User = {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  email: string;
  plateNumber?: string;
};

export type ActivityLog = {
  id: string;
  plate: string;
  studentId: string;
  name: string;
  timeIn: string;
  timeOut: string;
};
