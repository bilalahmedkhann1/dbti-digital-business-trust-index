/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { type ComponentProps } from "react";

const { assistedMutate } = vi.hoisted(() => ({ assistedMutate: vi.fn() }));

vi.mock("@/components/DBTIResults", () => ({
  DBTIResults: () => null,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    analysis: {
      scan: {
        useMutation: () => ({ isPending: false, mutate: vi.fn() }),
      },
      assistedScan: {
        useMutation: () => ({ isPending: false, mutate: assistedMutate }),
      },
    },
  },
}));

vi.mock("wouter", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  useLocation: () => ["/", vi.fn()],
}));

import Home from "@/pages/Home";
import { ThemeProvider } from "@/contexts/ThemeContext";

function renderHome() {
  return render(
    <ThemeProvider defaultTheme="light" switchable>
      <Home />
    </ThemeProvider>,
  );
}

describe("blocked-site recovery interaction", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/?simulate_access_restricted=1");
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  it("focuses the website field and shows targeted public-page guidance after the retry action", async () => {
    const user = userEvent.setup();
    renderHome();

    expect(await screen.findByText("This website blocks server-side scanning")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /try a public page/i }));

    const input = screen.getByLabelText("Search a business or website");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("alert").textContent).toContain("Paste a different publicly accessible page");
    expect(screen.queryByText("This website blocks server-side scanning")).toBeNull();
  });

  it("enables assisted analysis only after enough visible evidence is pasted", async () => {
    const user = userEvent.setup();
    renderHome();
    const input = screen.getByLabelText("Search a business or website");
    await user.type(input, "https://protected.example");
    const textarea = screen.getByLabelText("Paste visible public page text (free fallback)");
    const submit = screen.getByRole("button", { name: /analyze pasted evidence/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    await user.type(textarea, "Protected Example provides public products and customer support. Contact information and company details are visible on this page for visitors.");
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    await user.click(submit);
    expect(assistedMutate).toHaveBeenCalledWith(expect.objectContaining({ query: "https://protected.example", content: expect.stringContaining("Protected Example") }));
  });
});
