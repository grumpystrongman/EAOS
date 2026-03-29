export interface ApiError {
  code: string;
  message: string;
  requestId: string;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  tenantId: string;
  token: string;
}

export const apiRequest = async <T>(path: string, options: RequestOptions): Promise<T> => {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${options.token}`,
      "x-tenant-id": options.tenantId
    },
    body: options.body ? JSON.stringify(options.body) : null
  });

  if (!response.ok) {
    const error = (await response.json()) as ApiError;
    throw error;
  }

  return (await response.json()) as T;
};
