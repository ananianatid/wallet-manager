/// <reference types="jest" />

import { render } from "@testing-library/react-native";
import { ProgressRing } from "./progress-ring";

jest.mock("react-native-svg", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const Svg = (props: Record<string, unknown>) => React.createElement(View, props);
  Svg.displayName = "Svg";
  const Circle = (props: Record<string, unknown>) => React.createElement(View, props);
  Circle.displayName = "Circle";
  return { Svg, Circle };
});

describe("ProgressRing", () => {
  it("affiche le pourcentage arrondi et le rôle progressbar", async () => {
    const { getByRole, getByText } = await render(
      <ProgressRing progress={72.4} color="#000" trackColor="#eee" />,
    );

    expect(getByText("72")).toBeTruthy();
    expect(getByRole("progressbar")).toBeTruthy();
  });

  it("borne la progression entre 0 et 100", async () => {
    const { getByText } = await render(
      <ProgressRing progress={150} color="#000" trackColor="#eee" />,
    );

    expect(getByText("100")).toBeTruthy();
  });

  it("utilise le label d'accessibilité fourni", async () => {
    const { getByLabelText } = await render(
      <ProgressRing
        progress={40}
        color="#000"
        trackColor="#eee"
        accessibilityLabel="Voyage : 40 %"
      />,
    );

    expect(getByLabelText("Voyage : 40 %")).toBeTruthy();
  });
});
