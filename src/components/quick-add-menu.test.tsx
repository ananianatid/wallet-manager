/// <reference types="jest" />

import { render } from "@testing-library/react-native";
import { QuickAddMenu } from "./quick-add-menu";

jest.mock("lucide-react-native", () => ({
  ArrowDownLeft: () => null,
  ArrowLeftRight: () => null,
  ArrowUpRight: () => null,
  Plus: () => null,
  X: () => null,
}));

describe("QuickAddMenu", () => {
  it("exposes the three operation actions", async () => {
    const { getByText } = await render(<QuickAddMenu visible onClose={() => undefined} />);

    expect(getByText("Ajouter")).toBeTruthy();
    expect(getByText("Dépense")).toBeTruthy();
    expect(getByText("Revenu")).toBeTruthy();
    expect(getByText("Transfert")).toBeTruthy();
  });

});
