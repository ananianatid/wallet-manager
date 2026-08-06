import { hashPin, verifyPin } from "./pin";

const SALT = Uint8Array.from({ length: 16 }, (_, i) => 200 - i);

describe("hashPin / verifyPin", () => {
  it("vérifie un PIN correct", () => {
    const hash = hashPin("123456", SALT);
    expect(verifyPin("123456", SALT, hash)).toBe(true);
  });

  it("rejette un PIN incorrect", () => {
    const hash = hashPin("123456", SALT);
    expect(verifyPin("654321", SALT, hash)).toBe(false);
  });

  it("rejette un PIN différent seulement par la longueur", () => {
    const hash = hashPin("123456", SALT);
    expect(verifyPin("12345", SALT, hash)).toBe(false);
    expect(verifyPin("1234567", SALT, hash)).toBe(false);
  });

  it("différencie les sels", () => {
    const otherSalt = Uint8Array.from({ length: 16 }, (_, i) => i + 1);
    const hash = hashPin("123456", SALT);
    expect(verifyPin("123456", otherSalt, hash)).toBe(false);
  });
});
