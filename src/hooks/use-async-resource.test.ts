/// <reference types="jest" />

import { act, renderHook } from "@testing-library/react-native";
import { useAsyncResource } from "./use-async-resource";

describe("useAsyncResource", () => {
  it("exposes loading then ready states", async () => {
    const loader = jest.fn(async () => ["transaction"]);
    const { result } = await renderHook(() => useAsyncResource(loader));

    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBeNull();

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.data).toEqual(["transaction"]);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("keeps stale data when a refresh fails", async () => {
    let shouldFail = false;
    const loader = jest.fn(async () => {
      if (shouldFail) {
        throw new Error("SQLite indisponible");
      }
      return ["existing transaction"];
    });
    const { result } = await renderHook(() => useAsyncResource(loader));

    await act(async () => {
      await result.current.reload();
    });
    shouldFail = true;

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error?.message).toBe("SQLite indisponible");
    expect(result.current.data).toEqual(["existing transaction"]);
  });

  it("ignores an older request that resolves after a newer one", async () => {
    let resolveFirst: ((value: string[]) => void) | undefined;
    let resolveSecond: ((value: string[]) => void) | undefined;
    const loader = jest
      .fn<Promise<string[]>, []>()
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolveSecond = resolve;
        }),
      );
    const { result } = await renderHook(() => useAsyncResource(loader));

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = result.current.reload();
      second = result.current.reload();
    });

    await act(async () => {
      resolveSecond?.(["new"]);
      await second;
    });
    await act(async () => {
      resolveFirst?.(["old"]);
      await first;
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.data).toEqual(["new"]);
  });
});
