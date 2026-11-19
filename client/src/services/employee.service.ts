import axios from "axios";
import api from "./axios";
import type {
  EmployeeCategory,
  EmployeeDetailResponse,
  EmployeeInput,
  EmployeeListResponse,
} from "./types/employee.types";

function getError(error: unknown) {
  if (axios.isAxiosError<{ message?: string }>(error) && error.response) {
    return new Error(error.response.data?.message ?? "The request failed.");
  }
  return error instanceof Error ? error : new Error("Something went wrong.");
}

export const EmployeeService = {
  async list(
    query = "",
    category?: EmployeeCategory,
  ): Promise<EmployeeListResponse> {
    try {
      const { data } = await api.get<EmployeeListResponse>("/admin/employees", {
        params: {
          ...(query ? { q: query } : {}),
          ...(category ? { category } : {}),
        },
      });
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async get(id: string): Promise<EmployeeDetailResponse> {
    try {
      const { data } = await api.get<EmployeeDetailResponse>(
        `/admin/employees/${id}`,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async create(input: EmployeeInput): Promise<EmployeeDetailResponse> {
    try {
      const { data } = await api.post<EmployeeDetailResponse>(
        "/admin/employees",
        input,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async update(
    id: string,
    input: EmployeeInput,
  ): Promise<EmployeeDetailResponse> {
    try {
      const { data } = await api.patch<EmployeeDetailResponse>(
        `/admin/employees/${id}`,
        input,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async remove(id: string): Promise<void> {
    try {
      await api.delete(`/admin/employees/${id}`);
    } catch (error) {
      throw getError(error);
    }
  },
};
