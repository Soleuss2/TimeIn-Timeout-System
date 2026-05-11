export const MOCK_USERS = {
  students: [
    {
      id: "STU001",
      username: "Student01",
      password: "00000",
      name: "Juan Dela Cruz",
      role: "student",
      plateNumber: "ABC 1234",
      email: "juan@school.edu",
    },
    {
      id: "STU002",
      username: "Student02",
      password: "00000",
      name: "Maria Santos",
      role: "student",
      plateNumber: "XYZ 5678",
      email: "maria@school.edu",
    },
  ],
  guards: [
    {
      id: "GRD001",
      username: "Guard01",
      password: "00000",
      name: "John Smith",
      role: "guard",
      email: "john.guard@school.edu",
    },
  ],
  admins: [
    {
      id: "ADM001",
      username: "admin01",
      password: "00000",
      name: "Admin User",
      role: "admin",
      email: "admin@school.edu",
    },
  ],
};

export const MOCK_ACTIVITY_LOGS = [
  {
    id: "LOG001",
    plate: "ABC 1234",
    studentId: "STU001",
    name: "Juan Dela Cruz",
    timeIn: "07:45 AM",
    timeOut: "05:12 PM",
  },
  {
    id: "LOG002",
    plate: "XYZ 5678",
    studentId: "STU002",
    name: "Maria Santos",
    timeIn: "08:10 AM",
    timeOut: "04:58 PM",
  },
  {
    id: "LOG003",
    plate: "DEF 9876",
    studentId: "STU003",
    name: "Jose Rizal",
    timeIn: "07:55 AM",
    timeOut: "05:05 PM",
  },
];

export const authenticateUser = (username: string, password: string) => {
  const student = MOCK_USERS.students.find(
    (user) => user.username === username && user.password === password,
  );
  if (student) return student;

  const guard = MOCK_USERS.guards.find(
    (user) => user.username === username && user.password === password,
  );
  if (guard) return guard;

  const admin = MOCK_USERS.admins.find(
    (user) => user.username === username && user.password === password,
  );
  if (admin) return admin;

  return null;
};
