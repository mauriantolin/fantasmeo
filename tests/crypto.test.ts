import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt } from "@/lib/gmail/crypto";

beforeAll(() => {
  // 32 bytes hex = 64 chars
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

describe("encrypt/decrypt", () => {
  it("round-trips a token", () => {
    const token = "ya29.a0AfH6SMBx-secret-token-value";
    const encrypted = encrypt(token);
    expect(encrypted).not.toContain(token);
    expect(decrypt(encrypted)).toBe(token);
  });

  it("produces different ciphertexts for the same input (random IV)", () => {
    const token = "same-input";
    expect(encrypt(token)).not.toBe(encrypt(token));
  });

  it("throws when decrypting tampered data", () => {
    const encrypted = encrypt("token");
    const tampered = encrypted.slice(0, -4) + "0000";
    expect(() => decrypt(tampered)).toThrow();
  });
});
