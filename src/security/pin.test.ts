import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hashPin, verifyPin, PIN_PBKDF2_ITERATIONS } from "./pin";

const SALT = Uint8Array.from({ length: 16 }, (_, i) => 200 - i);

function legacyHash(pin: string, salt: Uint8Array): string {
  const input = new Uint8Array(salt.length + pin.length);
  input.set(salt, 0);
  for (let i = 0; i < pin.length; i++) {
    input[salt.length + i] = pin.charCodeAt(i);
  }
  return bytesToHex(sha256(input));
}

describe("hashPin / verifyPin", () => {
  it("vérifie un PIN correct", async () => {
    const hash = await hashPin("123456", SALT);
    expect(await verifyPin("123456", SALT, hash)).toBe(true);
  });

  it("rejette un PIN incorrect", async () => {
    const hash = await hashPin("123456", SALT);
    expect(await verifyPin("654321", SALT, hash)).toBe(false);
  });

  it("rejette un PIN différent seulement par la longueur", async () => {
    const hash = await hashPin("123456", SALT);
    expect(await verifyPin("12345", SALT, hash)).toBe(false);
    expect(await verifyPin("1234567", SALT, hash)).toBe(false);
  });

  it("différencie les sels", async () => {
    const otherSalt = Uint8Array.from({ length: 16 }, (_, i) => i + 1);
    const hash = await hashPin("123456", SALT);
    expect(await verifyPin("123456", otherSalt, hash)).toBe(false);
  });

  it("stocke les itérations PBKDF2 dans le préfixe du hash", async () => {
    const hash = await hashPin("123456", SALT);
    expect(hash.startsWith(`${PIN_PBKDF2_ITERATIONS}:`)).toBe(true);
  });

  it("accepte un hash legacy SHA-256 sans préfixe", async () => {
    const hash = legacyHash("123456", SALT);
    expect(await verifyPin("123456", SALT, hash)).toBe(true);
    expect(await verifyPin("654321", SALT, hash)).toBe(false);
  });
});
