import { authenticateUser } from './mockData';

export const AuthService = {
  login: async (username: string, password: string) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const user = authenticateUser(username, password);

    if (!user) {
      return {
        success: false,
        message: 'Username or password is incorrect.',
      };
    }

    return {
      success: true,
      user,
      message: `Welcome, ${user.name}`,
    };
  },
};
