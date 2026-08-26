import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("blocked-site recovery interface", () => {
  it("renders clear non-bypass guidance and an accessible public-page retry action", async () => {
    const home = await readFile(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(home).toContain("This website blocks server-side scanning");
    expect(home).toContain("DBTI will not bypass that control.");
    expect(home).toContain("Try a public page");
    expect(home).toContain("inputRef.current?.focus()");
    expect(home).toContain("simulate_access_restricted");
  });
});
