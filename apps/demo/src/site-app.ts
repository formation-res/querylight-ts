import "highlight.js/styles/github-dark.css";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import json from "highlight.js/lib/languages/json";
import typescript from "highlight.js/lib/languages/typescript";
import { mountDashboardApp } from "./dashboard-app";
import { mountSearchApp } from "./search-app";

type Cleanup = () => void;
type RouteMode = "search" | "dashboard" | "unknown";

const app = document.querySelector<HTMLDivElement>("#app");

hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);

function highlightCodeBlocks(root: ParentNode = document): void {
  for (const block of root.querySelectorAll<HTMLElement>("pre code")) {
    if (block.dataset.highlighted === "true") {
      continue;
    }
    hljs.highlightElement(block);
    block.dataset.highlighted = "true";
  }
}

function routeModeForPath(pathname: string): RouteMode {
  if (pathname === "/" || pathname.startsWith("/docs/")) {
    return "search";
  }
  if (pathname.startsWith("/dashboard/")) {
    return "dashboard";
  }
  return "unknown";
}

if (app) {
  let activeMode: RouteMode | null = null;
  let cleanup: Cleanup | null = null;
  let renderToken = 0;

  const renderCurrentRoute = async (force = false): Promise<void> => {
    const nextMode = routeModeForPath(window.location.pathname);
    if (nextMode === "unknown") {
      return;
    }
    if (!force && nextMode === activeMode) {
      return;
    }

    renderToken += 1;
    const currentToken = renderToken;

    cleanup?.();
    cleanup = null;
    activeMode = nextMode;

    const nextCleanup = nextMode === "dashboard"
      ? await mountDashboardApp(app)
      : await mountSearchApp(app);

    if (currentToken !== renderToken) {
      nextCleanup();
      return;
    }

    cleanup = nextCleanup;
    highlightCodeBlocks(app);
  };

  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const anchor = target?.closest<HTMLAnchorElement>("a[href]");
    if (
      !anchor ||
      event.defaultPrevented ||
      anchor.target ||
      anchor.hasAttribute("download") ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const url = new URL(anchor.href, window.location.origin);
    if (url.origin !== window.location.origin) {
      return;
    }

    const targetMode = routeModeForPath(url.pathname);
    if (targetMode === "unknown" || targetMode === activeMode) {
      return;
    }

    event.preventDefault();
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    void renderCurrentRoute(true);
  });

  window.addEventListener("popstate", () => {
    const nextMode = routeModeForPath(window.location.pathname);
    if (nextMode !== activeMode) {
      void renderCurrentRoute(true);
    }
  });

  void renderCurrentRoute(true);
}

highlightCodeBlocks();
