/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React, { type ComponentProps } from "react";

vi.mock("@/components/DBTIResults", () => ({
  DBTIResults: () => null,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    analysis: {
      scan: {
        useMutation: () => ({ isPending: false, mutate: vi.fn() }),
      },
    },
  },
}));

vi.mock("wouter", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  useLocation: () => ["/", vi.fn()],
}));

import Home from "@/pages/Home";

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
    render(<Home />);

    expect(await screen.findByText("This website blocks server-side scanning")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /try a public page/i }));

    const input = screen.getByLabelText("Search a business or website");
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole("alert").textContent).toContain("Paste a different publicly accessible page");
    expect(screen.queryByText("This website blocks server-side scanning")).toBeNull();
  });
});
