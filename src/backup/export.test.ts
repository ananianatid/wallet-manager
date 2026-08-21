import { shareableFileUri } from "./export";

describe("shareableFileUri", () => {
  it("conserve l'URI file:// attendue par expo-sharing", () => {
    const file = {
      uri: "file:///mock/cache/wallet-backup.wlbak",
      contentUri: "content://mock/wallet-backup.wlbak",
    };

    expect(shareableFileUri(file)).toBe(file.uri);
  });
});
