import axios from "axios";
import api from "./axios";
import type {
  ApproveApplicationInput,
  ApplicationDetailResponse,
  ApplicationsResponse,
  ApplicationDocumentKind,
  FranchiseApplicationStatus,
  SubmitApplicationResponse,
} from "./types/application.types";

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

export const FranchiseApplicationService = {
  async submit(formData: FormData): Promise<SubmitApplicationResponse> {
    try {
      const { data } = await api.post<SubmitApplicationResponse>(
        "/applications",
        formData,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async list(
    query = "",
    status?: Exclude<FranchiseApplicationStatus, "approving">,
  ): Promise<ApplicationsResponse> {
    try {
      const { data } = await api.get<ApplicationsResponse>(
        "/admin/applications",
        { params: { ...(query ? { q: query } : {}), ...(status ? { status } : {}) } },
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async detail(id: string): Promise<ApplicationDetailResponse> {
    try {
      const { data } = await api.get<ApplicationDetailResponse>(
        `/admin/applications/${id}`,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async reject(id: string, reason: string) {
    try {
      const { data } = await api.post(`/admin/applications/${id}/reject`, {
        reason,
      });
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async approve(id: string, input: ApproveApplicationInput) {
    try {
      const { data } = await api.post(
        `/admin/applications/${id}/approve`,
        input,
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },

  async downloadDocument(id: string, kind: ApplicationDocumentKind) {
    try {
      const { data } = await api.get<Blob>(
        `/admin/applications/${id}/documents/${kind}`,
        { responseType: "blob" },
      );
      return data;
    } catch (error) {
      throw getError(error);
    }
  },
};
