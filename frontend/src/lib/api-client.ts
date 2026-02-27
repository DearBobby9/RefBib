import {
  DiscoveryCheckResponse,
  ExtractError,
  ExtractResponse,
  GrobidInstancesResponse,
  Reference,
} from "./types";

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

export async function checkDiscovery(
  references: Reference[],
  maxItems = 20,
  signal?: AbortSignal
): Promise<DiscoveryCheckResponse> {
  const payload = {
    max_items: maxItems,
    references: references.map((reference) => ({
      index: reference.index,
      raw_citation: reference.raw_citation,
      title: reference.title,
      authors: reference.authors,
      year: reference.year,
      doi: reference.doi,
      venue: reference.venue,
    })),
  };

  const response = await fetch(`${API_BASE}/api/discovery/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
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

export async function checkServerHealth(): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/health`, {
    signal: AbortSignal.timeout(8000),
  });
  return response.ok;
}

export async function checkAuthRequired(): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/auth/status`);
  if (!response.ok) return false;
  const data: { required: boolean } = await response.json();
  return data.required;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/verify-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) return false;
  const data: { valid: boolean } = await response.json();
  return data.valid;
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
