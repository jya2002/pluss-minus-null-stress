import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../components/ui";
import type { Event, Registration } from "../lib/types";
import { demoEvents } from "../lib/demo";
import { EventDetail } from "./Events";

const backend = vi.hoisted(() => ({
  events: [] as Event[],
  rows: [] as Registration[],
  rpc: vi.fn(),
  ownRows: vi.fn(),
}));
vi.mock("../lib/auth", () => ({
  useAuth: () => ({ session: { user: { id: "student-a" } }, role: "student" }),
}));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    demo: false,
    api: {
      ...actual.api,
      events: async () => backend.events,
      summary: async () => [],
    },
    rpc: backend.rpc,
    db: () => ({
      from: (table: string) => {
        expect(table).toBe("event_registrations");
        return { select: () => ({ eq: backend.ownRows }) };
      },
    }),
  };
});

function registration(status: Registration["status"]): Registration {
  return {
    id: "registration-a",
    event_id: "test-event",
    user_id: "student-a",
    status,
    team_id: null,
    dietary: null,
    attended: false,
    created_at: new Date().toISOString(),
  };
}
function renderEvent() {
  return render(
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
      <MemoryRouter initialEntries={["/arrangementer/test-event"]}>
        <ToastProvider>
          <Routes>
            <Route path="/arrangementer/:id" element={<EventDetail />} />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const submit = () =>
  screen.findByRole("button", {
    name: "Meld meg på / sett meg på venteliste",
  });
beforeEach(() => {
  vi.resetAllMocks();
  backend.rows = [];
  backend.events = [
    {
      ...demoEvents[0],
      id: "test-event",
      status: "published",
      registration_mode: "individual",
      capacity: 1,
      deadline: new Date(Date.now() + 86400000).toISOString(),
      starts_at: new Date(Date.now() + 172800000).toISOString(),
      ends_at: new Date(Date.now() + 176400000).toISOString(),
    },
  ];
  backend.ownRows.mockImplementation(async () => ({
    data: backend.rows,
    error: null,
  }));
});

it.each([
  ["confirmed", "Du er påmeldt!"],
  ["waitlisted", "Du står på ventelisten."],
] as const)(
  "shows the server's %s status and submits only for the session user",
  async (status, message) => {
    backend.rpc.mockImplementation(async () => {
      backend.rows = [registration(status)];
      return status;
    });
    renderEvent();
    await userEvent.click(await submit());
    expect(
      await screen.findByText(message, { exact: true }),
    ).toBeInTheDocument();
    expect(backend.rpc).toHaveBeenCalledExactlyOnceWith("register_event", {
      p_event: "test-event",
      p_dietary: "",
      p_dietary_consent: false,
      p_team: null,
      p_team_name: null,
    });
    expect(backend.ownRows).toHaveBeenCalledWith("user_id", "student-a");
    expect(
      screen.queryByRole("button", { name: /Meld meg på/ }),
    ).not.toBeInTheDocument();
  },
);

it("keeps the form available and displays a server rejection without claiming success", async () => {
  backend.rpc.mockRejectedValue(new Error("Påmeldingen er stengt."));
  renderEvent();
  await userEvent.click(await submit());
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Påmeldingen er stengt.",
  );
  expect(await submit()).toBeEnabled();
  expect(backend.rows).toHaveLength(0);
  expect(
    screen.queryByText("Du er påmeldt!", { exact: true }),
  ).not.toBeInTheDocument();
});

it("does not offer a duplicate registration to an already registered student", async () => {
  backend.rows = [registration("confirmed")];
  renderEvent();
  expect(
    await screen.findByText("Du er påmeldt!", { exact: true }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Meld meg på/ }),
  ).not.toBeInTheDocument();
  expect(backend.rpc).not.toHaveBeenCalled();
});

it("validates dietary consent before sending any registration", async () => {
  renderEvent();
  const button = await submit();
  const user = userEvent.setup();
  await user.type(
    screen.getByRole("textbox", { name: /Kosthensyn/ }),
    "Nøtter",
  );
  await user.click(button);
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("Bekreft samtykke"),
  );
  expect(backend.rpc).not.toHaveBeenCalled();
});

it("hides registration after the deadline without calling the API", async () => {
  backend.events[0].deadline = new Date(Date.now() - 1000).toISOString();
  renderEvent();
  expect(await screen.findByText("Påmeldingen er stengt.")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Meld meg på/ }),
  ).not.toBeInTheDocument();
  expect(backend.rpc).not.toHaveBeenCalled();
});
