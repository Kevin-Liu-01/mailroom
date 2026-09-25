import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

describe("token encryption", () => {
  beforeAll(() => { process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64"); });
  it("round-trips and randomizes the nonce", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const a = encryptSecret("1//refresh-token");
    const b = encryptSecret("1//refresh-token");
    expect(a).not.toEqual(b);
    expect(decryptSecret(a)).toBe("1//refresh-token");
  });
  it("rejects tampering", async () => {
    const { encryptSecret, decryptSecret } = await import("@/lib/crypto");
    const enc = Buffer.from(encryptSecret("x"), "base64");
    enc[enc.length - 1] ^= 1;
    expect(() => decryptSecret(enc.toString("base64"))).toThrow();
  });
});
