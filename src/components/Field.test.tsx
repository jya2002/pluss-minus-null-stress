import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Field } from "./ui";
it("keeps the field name stable and associates hints and validation errors", () => {
  const view = render(
    <Field label="Tittel" hint="Skriv en kort tittel.">
      <input />
    </Field>,
  );
  const control = screen.getByRole("textbox", { name: "Tittel" });
  expect(control).toHaveAccessibleDescription("Skriv en kort tittel.");
  view.rerender(
    <Field label="Tittel" hint="Skriv en kort tittel." error="Minst tre tegn.">
      <input />
    </Field>,
  );
  expect(control).toHaveAccessibleName("Tittel");
  expect(control).toHaveAccessibleDescription(
    "Skriv en kort tittel. Minst tre tegn.",
  );
  expect(control).toHaveAttribute("aria-invalid", "true");
  view.rerender(
    <Field label="Tittel">
      <input />
    </Field>,
  );
  expect(control).not.toHaveAttribute("aria-invalid");
  expect(control).not.toHaveAttribute("aria-describedby");
});
it("select name excludes option text and preserves existing aria descriptions", () => {
  render(
    <>
      <p id="existing">Tidligere hjelp.</p>
      <Field label="Kategori" hint="Velg én.">
        <select aria-describedby="existing">
          <option>Quiz</option>
          <option>Spillkveld</option>
        </select>
      </Field>
    </>,
  );
  expect(
    screen.getByRole("combobox", { name: "Kategori" }),
  ).toHaveAccessibleDescription("Tidligere hjelp. Velg én.");
});
