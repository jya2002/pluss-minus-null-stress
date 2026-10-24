import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../lib/auth";
import { ToastProvider } from "./ui";
import App from "../App";
function app(path = "/") {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
it("viser forsiden og merker demonstrasjonsinnhold", async () => {
  app();
  expect(
    await screen.findByRole("heading", {
      name: /Mer fellesskap\.\s*Mindre stress\./i,
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Demovisning · Eksempelinnhold/)).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Se arrangementer/ }),
  ).toBeInTheDocument();
});
it("filtrerer arrangementer og finner tomtilstand", async () => {
  app("/arrangementer");
  const search = await screen.findByRole("textbox", {
    name: "Søk etter arrangementer",
  });
  await userEvent.type(search, "finnes ikke");
  expect(
    await screen.findByRole("heading", { name: "Ingen arrangementer funnet" }),
  ).toBeInTheDocument();
});
it("viser utkast uten aktiv påmelding", async () => {
  app("/arrangementer/quiz-kaos");
  expect(
    await screen.findByRole("heading", { name: "Quiz & Kaos", level: 1 }),
  ).toBeInTheDocument();
  expect(screen.getByText(/Dette er et utkast/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Meld meg på/ }),
  ).not.toBeInTheDocument();
});
it("gir ikke administratorrettigheter i demo", async () => {
  app("/admin");
  expect(
    await screen.findByText(/Administrasjon krever en ekte Supabase-konto/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /Nytt arrangement/ }),
  ).not.toBeInTheDocument();
});
