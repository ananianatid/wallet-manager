/// <reference types="jest" />

import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme";
import WebCloudSettings from "./web-cloud-settings";

const mockReplace = jest.fn();
const mockSyncNow = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: mockReplace },
}));

jest.mock("lucide-react-native", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const Icon = (props: Record<string, unknown>) => React.createElement(View, props);
  return { ChevronRight: Icon, LogOut: Icon, ShieldCheck: Icon };
});

jest.mock("@/cloud/auth-context", () => ({
  useCloudAuth: () => ({
    user: { email: "test@example.com", emailVerified: true },
    signOut: jest.fn(),
    refreshUser: jest.fn(),
    syncNow: mockSyncNow,
  }),
}));

describe("WebCloudSettings", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSyncNow.mockReset();
    mockSyncNow.mockResolvedValue({ pulled: 3 });
  });

  it("affiche le parcours compte et synchronisation et charge les données cloud", async () => {
    const { getByText, getByRole } = await render(
      <ThemeProvider>
        <WebCloudSettings />
      </ThemeProvider>,
    );

    expect(getByText("Compte et synchronisation")).toBeTruthy();
    fireEvent.press(getByRole("button", { name: "Charger mes données cloud" }));

    await waitFor(() => expect(mockSyncNow).toHaveBeenCalledTimes(1));
    expect(getByText("3 élément(s) cloud chargé(s) depuis PostgreSQL.")).toBeTruthy();
  });
});
