import { ExtractError, ExtractResponse, GrobidInstancesResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function extractReferences(
  file: File,
  options?: { signal?: AbortSignal; grobidInstanceId?: string }
): Promise<ExtractResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.grobidInstanceId) {
    formData.append("grobid_instance_id", options.grobidInstanceId);
  }

  const response = await fetch(`${API_BASE}/api/extract`, {
    method: "POST",
    body: formData,
    signal: options?.signal,
  });

  if (!response.ok) {
    const error: ExtractError = await response.json().catch(() => ({
      detail: `Server error (${response.status})`,
    }));
    throw new Error(error.detail);
  }

  return response.json();
}

export async function fetchGrobidInstances(): Promise<GrobidInstancesResponse> {
  const response = await fetch(`${API_BASE}/api/grobid-instances`);
  if (!response.ok) {
    throw new Error("Failed to fetch GROBID instances");
  }
  return response.json();
}

export async function checkGrobidHealth(
  instanceId: string,
  signal?: AbortSignal
): Promise<{ id: string; reachable: boolean }> {
  const response = await fetch(
    `${API_BASE}/api/grobid-instances/${encodeURIComponent(instanceId)}/health`,
    { signal }
  );
  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }
  return response.json();
}
