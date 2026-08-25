import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./index.css";

declare global {
  interface Window {
    __SUPABASE_CONFIG__?: {
      url: string;
      anonKey: string;
    };
  }
}

const staticSupabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL || "",
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
};

function isValidSupabaseConfig(config: { url?: string; anonKey?: string }) {
  if (!config.url || !config.anonKey) return false;
  try {
    new URL(config.url);
    return !config.url.includes("placeholder") && !config.anonKey.includes("placeholder");
  } catch {
    return false;
  }
}

async function loadDynamicSupabaseConfig() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch("/api/supabase-config", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.toLowerCase().includes("application/json")) {
      return;
    }

    const data = await response.json();
    if (isValidSupabaseConfig(data)) {
      window.__SUPABASE_CONFIG__ = data;
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "AbortError")) {
      console.warn("[Supabase Config] Không thể tải cấu hình động; đang dùng cấu hình build-time.");
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function start() {
  if (isValidSupabaseConfig(staticSupabaseConfig)) {
    window.__SUPABASE_CONFIG__ = staticSupabaseConfig;
  } else {
    void loadDynamicSupabaseConfig();
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

start();
