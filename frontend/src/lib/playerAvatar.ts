const UUID_PATTERN = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export const extractUuidFromFilename = (fileName: string): string | null => {
  if (!fileName) return null;

  const baseName = fileName.replace(/\.[^.]+$/, "").trim();
  if (!UUID_PATTERN.test(baseName)) {
    return null;
  }

  const compact = baseName.replace(/-/g, "").toLowerCase();
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20, 32)}`;
};

export const getPlayerAvatarUrls = (uuid: string, size = 96): string[] => {
  const compactUuid = uuid.replace(/-/g, "");

  return [
    `https://mc-heads.net/avatar/${compactUuid}/${size}`,
    `https://minotar.net/avatar/${compactUuid}/${size}`,
    `https://mc-heads.net/avatar/Steve/${size}`,
  ];
};

export const getPlayerUsername = async (uuid: string): Promise<string | null> => {
  const response = await fetch(`${API_BASE_URL}/player-name/${uuid}`);
  if (!response.ok) {
    return null;
  }

  try {
    const data = (await response.json()) as { username?: string | null };
    return data.username ?? null;
  } catch {
    return null;
  }
};
