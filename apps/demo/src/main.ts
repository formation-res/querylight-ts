import "./styles.css";
import { mountDashboardApp } from "./dashboard-app";
import { mountSearchApp } from "./search-app";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

type Cleanup = () => void;
type DemoRoute = "search" | "dashboard";

let cleanupCurrent: Cleanup | null = null;
let renderToken = 0;

function parseRoute(): DemoRoute {
  const hash = window.location.hash || "#/search";
  return hash.startsWith("#/dashboard") ? "dashboard" : "search";
}

function renderLoading(message: string): void {
  app.innerHTML = `
    <main class="mx-auto min-h-screen w-[min(1200px,calc(100vw-32px))] py-8">
      <section class="surface p-8">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Loading</p>
        <h1 class="mt-3 font-serif text-4xl text-stone-950">Preparing demo route</h1>
        <p class="mt-4 text-sm leading-7 text-stone-600">${message}</p>
      </section>
    </main>
  `;
}

async function renderRoute(): Promise<void> {
  const token = ++renderToken;
  const route = parseRoute();
  cleanupCurrent?.();
  cleanupCurrent = null;
  renderLoading(route === "dashboard" ? "Loading dashboard datasets and visualizations." : "Loading docs search.");

  const mount = route === "dashboard" ? mountDashboardApp : mountSearchApp;
  const cleanup = await mount(app);

  if (token !== renderToken) {
    cleanup();
    return;
  }

  cleanupCurrent = cleanup;
}

window.addEventListener("hashchange", () => {
  void renderRoute();
});

void renderRoute();
