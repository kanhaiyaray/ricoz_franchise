import axios from "axios";
import api from "./axios";
import type {
  AuthResponse,
  LoginInput,
  RegisterInput,
} from "./types/auth.types";

function getError(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    if (error.response) {
      return new Error(error.response.data?.message ?? "The request failed.");
    }
    if (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED") {
      return new Error(
        "Cannot reach the Ricoz API. Make sure the server is running and NEXT_PUBLIC_API_URL points to its /api/v1 URL.",
      );
    }
  }
  return error instanceof Error ? error : new Error("Something went wrong.");
}

export const AuthService = {
  sendOtp: async (email: string) => {
    try {
      const { data } = await api.post("/auth/send_otp", { email });
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  signup: async (registerInput: RegisterInput) => {
    try {
      const { data } = await api.post("/auth/register", registerInput);
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  acceptInvitation: async (input: {
    token: string;
    password: string;
    confirmPassword: string;
  }) => {
    try {
      const { data } = await api.post("/auth/accept-invitation", input);
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  login: async (loginInput: LoginInput): Promise<AuthResponse> => {
    try {
      const { data } = await api.post<AuthResponse>("/auth/login", loginInput);
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  refresh: async (): Promise<AuthResponse | null> => {
    try {
      const { data } = await api.post<AuthResponse>("/auth/refresh");
      return data;
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 400 || error.response?.status === 401)
      ) {
        return null;
      }
      throw getError(error);
    }
  },

  logout: async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      throw getError(error);
    }
  },
};
