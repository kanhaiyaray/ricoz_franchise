import axios from "axios";
import { clearAuth, setSession } from "@/redux/slice/auth.slice";
import { getStoreRef } from "@/redux/store.reference";
import type { AuthResponse } from "./types/auth.types";

function resolveApiBase(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();
  const isDev = process.env.NODE_ENV === "development";
  const browserHost =
    typeof window === "undefined" ? null : window.location.hostname;

  if (isDev && browserHost) {
    if (configured) {
      try {
        const parsed = new URL(configured);
        // If the configured URL points at localhost / 127.0.0.1, swap in
        // the browser's actual hostname so the refresh_token cookie stays
        // same-site (localhost:3000 ↔ localhost:10000).
        if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
          parsed.hostname = browserHost;
          return parsed.toString().replace(/\/$/, "");
        }
      } catch {
        // Malformed URL — fall through to the configured value.
      }
    } else {
      return `http://${browserHost}:10000/api/v1`;
    }
  }

  return configured;
}

const apiBaseURL = resolveApiBase();

if (!apiBaseURL) {
  console.error(
    "[ricoz] NEXT_PUBLIC_API_URL is not configured. All API requests will fail. " +
    "Set it to the Ricoz API base URL (e.g. https://api.example.com/api/v1)."
  );
}

const api = axios.create({
    baseURL: apiBaseURL,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

type RetryableRequest = NonNullable<import("axios").AxiosError["config"]> & {
  _retry?: boolean;
};

api.interceptors.request.use((config) => {
  if (!apiBaseURL) {
    throw new Error("Set NEXT_PUBLIC_API_URL to the Ricoz API base URL.");
  }
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    config.headers.delete("Content-Type");
  }
  if (typeof window !== "undefined") {
    const franchiseId = window.localStorage.getItem("dashboard-franchise-scope");
    if (franchiseId) {
      config.headers.set("X-Franchise-Id", franchiseId);
    } else {
      config.headers.delete("X-Franchise-Id");
    }
  }
  const token = getStoreRef().getState().auth.access_token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshPromise: Promise<AuthResponse> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const request = error.config as RetryableRequest | undefined;
    if (
      error.response?.status !== 401 ||
      !request ||
      request._retry ||
      request.url?.includes("/auth/")
    ) {
      return Promise.reject(error);
    }

    request._retry = true;
    try {
      refreshPromise ??= axios
        .post<AuthResponse>(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true },
        )
        .then(({ data }) => data)
        .finally(() => {
          refreshPromise = null;
        });

      const session = await refreshPromise;
      getStoreRef().dispatch(setSession({
        accessToken: session.access_token,
        user: session.user,
      }));
      request.headers.Authorization = `Bearer ${session.access_token}`;
      return api(request);
    } catch (refreshError) {
      getStoreRef().dispatch(clearAuth());
      return Promise.reject(refreshError);
    }
  },
);

export default api;
