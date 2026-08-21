/// <reference types="jest" />

import { render } from "@testing-library/react-native";
import LandingPage from "./index";

jest.mock("lucide-react-native", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const Icon = (props: Record<string, unknown>) => React.createElement(View, props);
  return new Proxy({}, { get: () => Icon });
});

describe("LandingPage", () => {
  it("se monte sans faire tomber l'ErrorBoundary web", async () => {
    const { getAllByText } = await render(<LandingPage />);
    expect(getAllByText("Wallet Manager", { exact: true }).length).toBeGreaterThan(0);
  });
});
