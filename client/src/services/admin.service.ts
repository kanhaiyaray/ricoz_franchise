import axios from "axios";
import api from "./axios";
import type {
  CreateFranchiseInput,
  DashboardResponse,
  FranchiseDetailResponse,
  FranchiseRole,
  FranchiseStatus,
  UpdateFranchiseInput,
} from "./types/admin.types";

function getError(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error) && error.response) {
    return new Error(error.response.data?.message ?? "The request failed.");
  }
  return error instanceof Error ? error : new Error("Something went wrong.");
}

export const AdminService = {
  async dashboard(): Promise<DashboardResponse> {
    try {
      const { data } = await api.get<DashboardResponse>("/admin/dashboard");
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async listFranchises(query = "", status = "") {
    try {
      const { data } = await api.get("/admin/franchises", {
        params: {
          ...(query ? { q: query } : {}),
          ...(status ? { status } : {}),
        },
      });
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async createFranchise(input: CreateFranchiseInput) {
    try {
      const { data } = await api.post("/admin/franchises", input);
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async franchise(id: string): Promise<FranchiseDetailResponse> {
    try {
      const { data } = await api.get<FranchiseDetailResponse>(
        `/admin/franchises/${id}`,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async updateFranchise(id: string, input: UpdateFranchiseInput) {
    try {
      const { data } = await api.patch(`/admin/franchises/${id}`, input);
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async setFranchiseStatus(id: string, status: FranchiseStatus) {
    try {
      const { data } = await api.patch(`/admin/franchises/${id}/status`, {
        status,
      });
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async addFranchiseUser(
    id: string,
    input: { name: string; email: string; franchiseRole: FranchiseRole },
  ) {
    try {
      const { data } = await api.post(`/admin/franchises/${id}/users`, input);
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async attachFranchiseUser(
    id: string,
    input: { email: string; franchiseRole: FranchiseRole },
  ) {
    try {
      const { data } = await api.post(
        `/admin/franchises/${id}/users/attach`,
        input,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async updateFranchiseUser(
    id: string,
    userId: string,
    input: { name?: string; franchiseRole?: FranchiseRole },
  ) {
    try {
      const { data } = await api.patch(
        `/admin/franchises/${id}/users/${userId}`,
        input,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async resendInvitation(id: string, userId: string) {
    try {
      const { data } = await api.post(
        `/admin/franchises/${id}/users/${userId}/invite`,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },
};
