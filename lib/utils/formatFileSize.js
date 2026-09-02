export function formatFileSize(bytes) {
  if (bytes === null || bytes === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = Number(bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${units[unit]}`;
}

const DEFAULT_MAX_BYTES = 500 * 1024 * 1024; // 500 MB per file

const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".msi", ".com", ".scr", ".ps1", ".vbs", ".jar",
];

/** Validates type + size before anything touches storage. */
export function validateFile(file, { maxSizeBytes = DEFAULT_MAX_BYTES } = {}) {
  if (!file) return { valid: false, error: "No file provided." };

  const nameLower = (file.name || "").toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => nameLower.endsWith(ext))) {
    return { valid: false, error: "Executable files are not allowed." };
  }

  if (file.size <= 0) return { valid: false, error: "File is empty." };
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File is larger than the ${formatFileSize(maxSizeBytes)} limit.`,
    };
  }

  return { valid: true };
}
