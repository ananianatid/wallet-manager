import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import { DERIVED_KEY_BYTES, deriveBackupKey } from "./kdf";

const RFC6070_VECTORS = [
  {
    password: "password",
    salt: "salt",
    iterations: 1,
    expected:
      "120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b",
  },
  {
    password: "password",
    salt: "salt",
    iterations: 2,
    expected:
      "ae4d0c95af6b46d32d0adff928f06dd02a303f8ef3c251dfd6e2d85a95474c43",
  },
  {
    password: "password",
    salt: "salt",
    iterations: 4096,
    expected:
      "c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a",
  },
];

describe("deriveBackupKey", () => {
  it.each(RFC6070_VECTORS)(
    "PBKDF2-HMAC-SHA256 ($iterations itérations) — vecteur RFC 6070",
    async ({ password, salt, iterations, expected }) => {
      const key = await deriveBackupKey(
        password,
        new TextEncoder().encode(salt),
        iterations,
      );
      expect(key.length).toBe(DERIVED_KEY_BYTES);
      expect(bytesToHex(key)).toBe(expected);
    },
  );

  it("produit des clés différentes pour des sels différents", async () => {
    const a = await deriveBackupKey(
      "mot de passe",
      hexToBytes("00".repeat(16)),
      10,
    );
    const b = await deriveBackupKey(
      "mot de passe",
      hexToBytes("ff".repeat(16)),
      10,
    );
    expect(a).not.toEqual(b);
  });
});
