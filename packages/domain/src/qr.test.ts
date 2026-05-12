import { describe, expect, it } from "vitest";
import { businessQrType, signQr, verifyQrSignature, type QrSignatureInput } from "./qr";

describe("QR signatures", () => {
  it("accepts the original payload and rejects tampered codes", () => {
    const secret = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const signed: QrSignatureInput = {
      eventId: "event-1",
      code: "qr_original",
      type: businessQrType
    };
    const signature = signQr(signed, secret);

    expect(verifyQrSignature({ ...signed, signature }, secret)).toBe(true);
    expect(verifyQrSignature({ ...signed, code: "qr_tampered", signature }, secret)).toBe(false);
  });
});
