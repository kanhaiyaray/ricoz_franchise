export type UserPortal = "franchise" | "admin";

export type RegisterInput = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  otp: string;
};

export type LoginInput = {
  email: string;
  password: string;
  portal: UserPortal;
};

export type AuthUser = {
  user_id: string;
  user_name: string;
  user_email: string;
  user_dp: string;
  user_about: string;
  user_role: UserPortal;
};

export type AuthResponse = {
  success: true;
  access_token: string;
  user: AuthUser;
};
