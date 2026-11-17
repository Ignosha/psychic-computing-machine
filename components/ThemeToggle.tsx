"use client";
import { useEffect, useState } from "react";

// Follows the OS theme until the visitor picks one; the choice is remembered on this device only.
export default function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem("ng-theme"); } catch {}
    const t = saved === "light" || saved === "dark" ? saved : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    setTheme(t);
  }, []);
  const flip = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("ng-theme", next); } catch {}
    setTheme(next);
  };
  return <button type="button" className="theme" onClick={flip} aria-label="Switch colour theme">◐ {theme === "light" ? "Dark" : "Light"}</button>;
}
