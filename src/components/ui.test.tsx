/// <reference types="jest" />

import { render } from "@testing-library/react-native";
import { TextInput } from "react-native";
import { ActionButton, FormField, IconButton } from "./ui";

describe("shared UI primitives", () => {
  it("exposes button labels and disabled state to accessibility services", async () => {
    const { getByRole } = await render(
      <ActionButton label="Enregistrer" onPress={() => undefined} disabled />,
    );

    const button = getByRole("button");
    expect(button.props.accessibilityLabel).toBe("Enregistrer");
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
  });

  it("exposes icon button label and selected state", async () => {
    const { getByRole } = await render(
      <IconButton
        label="Afficher les filtres"
        icon={null}
        onPress={() => undefined}
        selected
      />,
    );

    const button = getByRole("button");
    expect(button.props.accessibilityLabel).toBe("Afficher les filtres");
    expect(button.props.accessibilityState).toMatchObject({ selected: true });
  });

  it("keeps field errors adjacent to the labelled input", async () => {
    const { getByLabelText, getByRole } = await render(
      <FormField label="Montant" error="Saisissez un montant positif.">
        <TextInput accessibilityLabel="Montant" />
      </FormField>,
    );

    expect(getByLabelText("Montant")).toBeTruthy();
    expect(getByRole("alert").props.children).toBe("Saisissez un montant positif.");
  });
});
