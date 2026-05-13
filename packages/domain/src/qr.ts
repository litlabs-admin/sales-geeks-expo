import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const businessQrType = "business";
export const staffMiscQrTypes = [
  "guest_speaker",
  "ad_hoc_session",
  "bonus_zone",
  "workshop",
  "vip",
  "networking"
] as const;
export const systemQrTypes = ["sponsor", "session", "hidden_bonus"] as const;
export const qrTypes = [businessQrType, ...staffMiscQrTypes, ...systemQrTypes] as const;
export const qrOwnerTypes = ["business", "misc"] as const;

export type QrType = (typeof qrTypes)[number];
export type StaffMiscQrType = (typeof staffMiscQrTypes)[number];
export type QrOwnerType = (typeof qrOwnerTypes)[number];

export type QrSignatureInput = {
  eventId: string;
  code: string;
  type: QrType;
};

function secretBytes(secret: string) {
  return /^[0-9a-f]{64}$/i.test(secret) ? Buffer.from(secret, "hex") : Buffer.from(secret, "utf8");
}

export function createQrCode(prefix = "qr") {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}

export function qrPurposeFingerprint(input: {
  ownerType: QrOwnerType;
  ownerId: string | null;
  type: QrType;
  reason?: string | null;
}) {
  if (input.ownerType === "business") {
    return "business:primary";
  }

  const reason = input.reason?.trim().toLowerCase().replace(/\s+/g, " ") ?? "misc";
  return `${input.type}:${reason}`;
}

export function signQr(input: QrSignatureInput, secret: string) {
  return createHmac("sha256", secretBytes(secret))
    .update(`${input.eventId}:${input.code}:${input.type}`)
    .digest("hex");
}

export function verifyQrSignature(input: QrSignatureInput & { signature: string }, secret: string) {
  const expected = signQr(input, secret);

  try {
    const left = Buffer.from(input.signature, "hex");
    const right = Buffer.from(expected, "hex");

    return left.length === right.length && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export function businessQrUrl(input: { eventSlug: string; code: string; signature: string }) {
  return `/${input.eventSlug}/scan/${input.code}?sig=${input.signature}`;
}

export function isStaffMiscQrType(value: unknown): value is StaffMiscQrType {
  return typeof value === "string" && staffMiscQrTypes.includes(value as StaffMiscQrType);
}

export function isQrType(value: unknown): value is QrType {
  return (
    typeof value === "string" &&
    (qrTypes as readonly string[]).includes(value)
  );
}

export function matchingSignedQrType(input: {
  eventId: string;
  code: string;
  signature: string;
  secret: string;
}): QrType | null {
  const candidates = [businessQrType, ...staffMiscQrTypes, ...systemQrTypes] as QrType[];

  return (
    candidates.find((type) =>
      verifyQrSignature(
        {
          eventId: input.eventId,
          code: input.code,
          type,
          signature: input.signature
        },
        input.secret
      )
    ) ?? null
  );
}
