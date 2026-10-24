import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/ui";
import Thursday from "./Thursday";

const backend = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn() }));
vi.mock("../lib/api", () => ({
  demo: false,
  api: {
    suggestions: async () => [],
    polls: async () => [],
    options: async () => [],
  },
  rpc: backend.rpc,
  upload: backend.upload,
  imageUrl: () => undefined,
  db: vi.fn(),
  request: vi.fn(),
}));
vi.mock("../lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "private-student-identity" } } }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  backend.rpc.mockResolvedValue("suggestion-id");
});

it("never uploads a previously selected image when the student switches to anonymous display", async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={["/torsdagsbanken?nytt=1"]}>
        <ToastProvider>
          <Thursday />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await user.type(
    screen.getByLabelText("Tittel", { exact: true }),
    "Brettspilltorsdag",
  );
  await user.type(
    screen.getByLabelText("Beskriv ideen", { exact: true }),
    "Vi spiller brettspill og blir kjent.",
  );
  await user.type(
    screen.getByLabelText("Budsjett i kr (valgfritt)", { exact: true }),
    "200",
  );
  const file = screen.getByLabelText("Bilde (valgfritt)");
  await user.upload(
    file,
    new File(["image"], "private.jpg", { type: "image/jpeg" }),
  );
  await user.click(screen.getByLabelText("Vis meg som anonym student"));
  expect(file).toBeDisabled();
  expect(screen.getByLabelText("Tittel", { exact: true })).toHaveValue(
    "Brettspilltorsdag",
  );
  expect(
    screen.getByText(
      "Anonyme forslag publiseres uten bilde for å beskytte identiteten din.",
    ),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Send inn forslaget" }));
  await waitFor(() =>
    expect(backend.rpc).toHaveBeenCalledWith("submit_suggestion", {
      p_title: "Brettspilltorsdag",
      p_description: "Vi spiller brettspill og blir kjent.",
      p_category: "Sosialt",
      p_date: null,
      p_budget: 200,
      p_anonymous: true,
      p_image: null,
    }),
  );
  expect(backend.upload).not.toHaveBeenCalled();
});
