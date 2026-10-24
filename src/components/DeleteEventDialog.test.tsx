import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import DeleteEventDialog from "./DeleteEventDialog";
import { deleteDraftEvent } from "../lib/api";
import { demoEvents } from "../lib/demo";
import type { Event } from "../lib/types";

vi.mock("../lib/api", () => ({ deleteDraftEvent: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const event: Event = {
  ...demoEvents[0],
  title: "Et tomt utkast",
  status: "draft",
};
function dialog(value = event) {
  const callbacks = { onClose: vi.fn(), onDeleted: vi.fn(), onEdit: vi.fn() };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DeleteEventDialog event={value} {...callbacks} />
    </QueryClientProvider>,
  );
  return { ...callbacks, user: userEvent.setup() };
}
it("requires the exact title and explicit confirmation before calling the deletion API", async () => {
  vi.mocked(deleteDraftEvent).mockResolvedValue(event.id);
  const { user, onDeleted } = dialog();
  const confirm = screen.getByRole("button", { name: "Slett permanent" });
  const input = screen.getByRole("textbox", {
    name: "Skriv arrangementets eksakte tittel",
  });
  expect(confirm).toBeDisabled();
  for (const value of [event.title.toUpperCase(), `${event.title} `]) {
    await user.clear(input);
    await user.type(input, value);
    expect(confirm).toBeDisabled();
  }
  await user.clear(input);
  await user.type(input, event.title);
  expect(confirm).toBeEnabled();
  expect(deleteDraftEvent).not.toHaveBeenCalled();
  await user.click(confirm);
  await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  expect(deleteDraftEvent).toHaveBeenCalledExactlyOnceWith(
    event.id,
    event.title,
  );
});
it("keeps the title and dialog visible when the server rejects linked data; does not retry", async () => {
  vi.mocked(deleteDraftEvent).mockRejectedValue(
    new Error("Utkastet har påmeldinger og kan ikke slettes."),
  );
  const { user, onDeleted, onClose } = dialog();
  const input = screen.getByLabelText("Skriv arrangementets eksakte tittel");
  await user.type(input, event.title);
  await user.click(screen.getByRole("button", { name: "Slett permanent" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Utkastet har påmeldinger",
  );
  expect(input).toHaveValue(event.title);
  expect(deleteDraftEvent).toHaveBeenCalledOnce();
  expect(onDeleted).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});
it.each(["published", "cancelled"] as const)(
  "explains %s restrictions without offering a destructive confirmation",
  async (status) => {
    const { user, onEdit } = dialog({ ...event, status });
    expect(
      screen.getByRole("dialog", { name: "Arrangementet kan ikke slettes" }),
    ).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Slett permanent" }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Rediger publiseringsstatus" }),
    );
    expect(onEdit).toHaveBeenCalledOnce();
    expect(deleteDraftEvent).not.toHaveBeenCalled();
  },
);
it("retains the draft when the operator cancels", async () => {
  const { user, onClose } = dialog();
  await user.click(screen.getByRole("button", { name: "Behold utkastet" }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(deleteDraftEvent).not.toHaveBeenCalled();
});
it("prevents duplicate submission and dismissal while deletion is pending", async () => {
  let finish!: (value: string) => void;
  vi.mocked(deleteDraftEvent).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { user, onClose, onDeleted } = dialog();
  await user.type(
    screen.getByLabelText("Skriv arrangementets eksakte tittel"),
    event.title,
  );
  await user.click(screen.getByRole("button", { name: "Slett permanent" }));
  expect(
    await screen.findByRole("button", { name: "Sletter …" }),
  ).toBeDisabled();
  expect(
    screen.getByLabelText("Skriv arrangementets eksakte tittel"),
  ).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Lukk dialog" }));
  expect(onClose).not.toHaveBeenCalled();
  expect(deleteDraftEvent).toHaveBeenCalledOnce();
  finish(event.id);
  await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
});
