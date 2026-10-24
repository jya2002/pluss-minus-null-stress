import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import EventCard from "./EventCard";
import { demoEvents } from "../lib/demo";
import type { Event } from "../lib/types";

const upcoming: Event = {
  ...demoEvents[0],
  id: "card-test",
  title: "Et ekte arrangement",
  status: "published",
  starts_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  ends_at: new Date(Date.now() + 8 * 86400000).toISOString(),
  deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
  image_path: null,
  is_demo: false,
};
function card(event: Event) {
  return render(
    <MemoryRouter>
      <EventCard event={event} />
    </MemoryRouter>,
  );
}
describe("arrangementskort i den nye identiteten", () => {
  it("viser dato og gir inngang til eksisterende påmeldingsside", () => {
    card(upcoming);
    expect(
      screen.getByRole("link", { name: "Meld deg på: Et ekte arrangement" }),
    ).toHaveAttribute("href", "/arrangementer/card-test");
    expect(
      screen.getByRole("link", { name: "Et ekte arrangement" }),
    ).toHaveAttribute("href", "/arrangementer/card-test");
    expect(document.querySelector("time")).toHaveAttribute(
      "datetime",
      upcoming.starts_at,
    );
    expect(screen.queryByText("Demo")).not.toBeInTheDocument();
  });
  it.each(["draft", "cancelled"] as const)(
    "beholder tydelig status for %s uten en påmeldingsoppfordring",
    (status) => {
      card({ ...upcoming, status });
      expect(
        screen.queryByRole("link", { name: /Meld deg på:/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(status === "draft" ? "Utkast" : "Avlyst"),
      ).toBeInTheDocument();
    },
  );
  it("viser vanlig detaljlenke når påmeldingsfristen er passert", () => {
    card({ ...upcoming, deadline: new Date(Date.now() - 60000).toISOString() });
    expect(
      screen.getByRole("link", { name: "Se arrangement: Et ekte arrangement" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Meld deg på:/ }),
    ).not.toBeInTheDocument();
  });
});
