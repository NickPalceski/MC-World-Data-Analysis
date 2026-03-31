const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const buildErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = (await response.json()) as { detail?: string };
    return data.detail ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
};

export const uploadSingleFile = async (
  endpoint: string,
  fieldName: string,
  file: File,
): Promise<unknown> => {
  const formData = new FormData();
  formData.append(fieldName, file);

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
};

export const uploadMultipleFiles = async (
  endpoint: string,
  fieldName: string,
  files: File[],
): Promise<unknown> => {
  const formData = new FormData();
  files.forEach((file) => formData.append(fieldName, file));

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
};

export const uploadProgressionFiles = async (
  advancementsFile: File,
  datFile?: File,
): Promise<unknown> => {
  const formData = new FormData();
  formData.append("advancements_file", advancementsFile);
  if (datFile) {
    formData.append("dat_file", datFile);
  }

  const response = await fetch(`${API_BASE_URL}/progression`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
};
