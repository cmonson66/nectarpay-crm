import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={mounted && !isDark ? "Switch to dark mode" : "Switch to light mode"}
      title={mounted && !isDark ? "Switch to dark mode" : "Switch to light mode"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white ${className}`}
    >
      {mounted && !isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
