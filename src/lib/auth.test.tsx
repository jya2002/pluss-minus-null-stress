import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { it, expect, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";
const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}));
vi.mock("./api", () => ({ supabase: { auth } }));
function Consumer() {
  const { loading, authError } = useAuth();
  return <p>{loading ? "Venter" : (authError?.message ?? "Klar")}</p>;
}
it.each(["response", "rejection"])(
  "restoration %s errors stop loading and expose only a safe recovery message",
  async (mode) => {
    if (mode === "response")
      auth.getSession.mockResolvedValue({
        data: { session: null },
        error: new Error("private-provider-response"),
      });
    else
      auth.getSession.mockRejectedValue(new Error("private-provider-response"));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText(/Innloggingen kunne ikke gjenopprettes/),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent("private-provider-response");
    expect(screen.queryByText("Venter")).not.toBeInTheDocument();
  },
);
