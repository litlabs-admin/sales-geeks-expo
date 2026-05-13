export function backendBaseUrl() {
  const raw = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!raw) {
    throw new Error("Missing BACKEND_URL or NEXT_PUBLIC_BACKEND_URL");
  }

  return raw.replace(/\/health$/, "").replace(/\/$/, "");
}

export function devPreviewEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_PREVIEW === "true";
}
