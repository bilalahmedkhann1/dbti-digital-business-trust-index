import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";

export default function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) return null;

  const nextTheme = theme === "light" ? "dark" : "light";
  const label = `Switch to ${nextTheme} mode`;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={toggleTheme}
        aria-label={label}
        aria-pressed={theme === "dark"}
        title={label}
        className="size-12 rounded-full border-[var(--theme-toggle-border)] bg-[var(--theme-toggle-surface)] text-[var(--theme-toggle-foreground)] shadow-[0_14px_32px_rgba(27,23,22,0.22)] backdrop-blur transition-transform hover:bg-[var(--theme-toggle-hover)] hover:text-[var(--theme-toggle-foreground)] active:scale-95"
      >
        {theme === "light" ? <Moon className="size-5" aria-hidden="true" /> : <Sun className="size-5" aria-hidden="true" />}
      </Button>
    </div>
  );
}
