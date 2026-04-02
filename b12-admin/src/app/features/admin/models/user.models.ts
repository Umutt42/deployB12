export type Role = 'ADMIN' | 'USER' | 'VISITOR';

export interface User {
  id: number;
  email: string;
  role: Role;

  active: boolean;
  forcePasswordChange: boolean;

  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserRequest {
  email: string;
  role: Role;
  tempPassword: string; // choix A
}

export interface ResetUserPasswordRequest {
  newPassword: string;
  confirmPassword: string;
}
