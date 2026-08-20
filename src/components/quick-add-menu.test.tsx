/// <reference types="jest" />

import { fireEvent, render } from "@testing-library/react-native";
import { AddFab } from "./quick-add-menu";

jest.mock("lucide-react-native", () => ({ Plus: () => null }));

describe("AddFab", () => {
  it("opens the transaction form directly", async () => {
    const onPress = jest.fn();
    const { getByRole } = await render(<AddFab onPress={onPress} bottom={80} />);

    expect(getByRole("button", { name: "Ajouter une opération" })).toBeTruthy();
    await fireEvent.press(getByRole("button", { name: "Ajouter une opération" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
