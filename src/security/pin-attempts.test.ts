import { hashPin, PIN_LOCKOUT_SECONDS, PIN_MAX_ATTEMPTS } from "./pin";
import {
  checkPinAttemptState,
  clearPinAttempts,
  recordPinFailure,
  verifyPinGuarded,
} from "./pin-attempts";

jest.mock("./store", () => {
  const state: Record<string, string> = {};
  Object.defineProperty(globalThis, "__PIN_STORE_STATE", {
    value: state,
    writable: true,
    configurable: true,
  });
  return {
    getFailedPinAttempts: jest.fn(async () => Number(state.failed) || 0),
    setFailedPinAttempts: jest.fn(async (n: number) => {
      state.failed = String(n);
    }),
    getPinLockoutUntil: jest.fn(async () =>
      state.until != null ? Number(state.until) : null,
    ),
    setPinLockoutUntil: jest.fn(async (u: number | null) => {
      if (u == null) {
        delete state.until;
      } else {
        state.until = String(u);
      }
    }),
    getPinHash: jest.fn(async () => state.hash ?? null),
    getPinSalt: jest.fn(async () =>
      state.salt ? new Uint8Array(JSON.parse(state.salt)) : null,
    ),
  };
});

const storeState = (
  globalThis as unknown as { __PIN_STORE_STATE: Record<string, string> }
).__PIN_STORE_STATE;

const SALT = Uint8Array.from({ length: 16 }, (_, i) => 200 - i);

async function seedValidPin(pin = "123456"): Promise<void> {
  storeState.salt = JSON.stringify(Array.from(SALT));
  storeState.hash = await hashPin(pin, SALT);
}

describe("checkPinAttemptState", () => {
  beforeEach(() => {
    delete storeState.failed;
    delete storeState.until;
    delete storeState.hash;
    delete storeState.salt;
  });

  it("renvoie l'état initial sans échec", async () => {
    const state = await checkPinAttemptState();
    expect(state).toEqual({
      lockedOut: false,
      remainingMs: 0,
      attempts: 0,
      remainingAttempts: PIN_MAX_ATTEMPTS,
    });
  });

  it("signale un verrouillage persistant et son temps restant", async () => {
    const now = 1_000_000;
    storeState.until = String(now + 30_000);
    const state = await checkPinAttemptState(now);
    expect(state.lockedOut).toBe(true);
    expect(state.remainingMs).toBe(30_000);
  });

  it("ignore un verrouillage expiré", async () => {
    const now = 1_000_000;
    storeState.until = String(now - 1_000);
    const state = await checkPinAttemptState(now);
    expect(state.lockedOut).toBe(false);
  });
});

describe("recordPinFailure", () => {
  beforeEach(() => {
    delete storeState.failed;
    delete storeState.until;
    delete storeState.hash;
    delete storeState.salt;
  });

  it("incrémente les échecs jusqu'à la limite", async () => {
    const now = 1_000_000;
    for (let i = 1; i < PIN_MAX_ATTEMPTS; i++) {
      const state = await recordPinFailure(now);
      expect(state.lockedOut).toBe(false);
      expect(state.attempts).toBe(i);
      expect(state.remainingAttempts).toBe(PIN_MAX_ATTEMPTS - i);
    }
  });

  it("verrouille au 5e échec et persiste la durée", async () => {
    const now = 1_000_000;
    for (let i = 0; i < PIN_MAX_ATTEMPTS - 1; i++) {
      await recordPinFailure(now);
    }
    const state = await recordPinFailure(now);
    expect(state.lockedOut).toBe(true);
    expect(state.remainingMs).toBe(PIN_LOCKOUT_SECONDS * 1000);
    expect(Number(storeState.until)).toBe(now + PIN_LOCKOUT_SECONDS * 1000);
    expect(Number(storeState.failed)).toBe(0);
  });

  it("reste verrouillé pendant le lockout sans consommer d'essai", async () => {
    const now = 1_000_000;
    for (let i = 0; i < PIN_MAX_ATTEMPTS; i++) {
      await recordPinFailure(now);
    }
    const again = await recordPinFailure(now + 10_000);
    expect(again.lockedOut).toBe(true);
    expect(again.remainingMs).toBe(20_000);
  });
});

describe("verifyPinGuarded", () => {
  beforeEach(async () => {
    delete storeState.failed;
    delete storeState.until;
    delete storeState.hash;
    delete storeState.salt;
    await seedValidPin();
  });

  it("accepte le bon PIN et réinitialise le compteur", async () => {
    await recordPinFailure();
    const { ok, state } = await verifyPinGuarded("123456");
    expect(ok).toBe(true);
    expect(state.remainingAttempts).toBe(PIN_MAX_ATTEMPTS);
    expect(await checkPinAttemptState()).toMatchObject({ attempts: 0 });
  });

  it("rejette un mauvais PIN et incrémente le compteur", async () => {
    const { ok, state } = await verifyPinGuarded("000000");
    expect(ok).toBe(false);
    expect(state.attempts).toBe(1);
  });

  it("refuse la vérification pendant un verrouillage persistant", async () => {
    const now = 1_000_000;
    storeState.until = String(now + 30_000);
    const { ok, state } = await verifyPinGuarded("123456", now);
    expect(ok).toBe(false);
    expect(state.lockedOut).toBe(true);
  });
});

describe("clearPinAttempts", () => {
  it("réinitialise échecs et verrouillage", async () => {
    await recordPinFailure();
    storeState.until = String(Date.now() + 30_000);
    await clearPinAttempts();
    expect(Number(storeState.failed)).toBe(0);
    expect(storeState.until).toBeUndefined();
  });
});
