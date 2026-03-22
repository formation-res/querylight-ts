import { expect, test } from "@playwright/test";

function readFacetCount(text: string | null): number {
  const match = text?.match(/(\d+)\s*$/);
  if (!match) {
    throw new Error(`Could not parse facet count from: ${text ?? "<null>"}`);
  }
  return Number.parseInt(match[1] ?? "0", 10);
}

test("detail tag facet keeps results usable", async ({ page }) => {
  await page.goto("/");

  const queryInput = page.locator("#query");
  await queryInput.fill("terms");
  await page.locator("#submit-query").click();

  await expect(page.getByText(/results ·/i)).toBeVisible();
  await page.getByRole("button", { name: /Terms Aggregation/i }).first().click();

  await expect(page.locator("#center-view")).toContainText("Terms Aggregation");
  await page.locator("#center-view").getByRole("button", { name: "discovery", exact: true }).click();

  await expect(page.locator("#active-filters-inline")).toContainText("Tag: discovery");
  await expect(page.getByText(/results ·/i)).toBeVisible();
  await expect(page.locator("#center-view")).toContainText("Terms Aggregation");
  await expect(page.locator("#center-view")).not.toContainText("No matches found");
});

test("facet count matches the current-query result count after applying it", async ({ page }) => {
  await page.goto("/");

  const queryInput = page.locator("#query");
  await queryInput.fill("terms");
  await page.locator("#submit-query").click();

  const firstTagFacet = page.locator('#facet-sections [data-facet="tag"]').first();
  const expectedCount = readFacetCount(await firstTagFacet.textContent());
  const expectedTag = await firstTagFacet.getAttribute("data-value");

  await firstTagFacet.click();

  await expect(page.locator("#active-filters-inline")).toContainText(`Tag: ${expectedTag}`);
  await expect(page.locator("#result-count")).toHaveText(new RegExp(`^${expectedCount} matches`));
});

test("tag facet without a text query still returns results", async ({ page }) => {
  await page.goto("/docs/discovery/terms-aggregation/");

  await page.getByRole("button", { name: "discovery", exact: true }).click();

  await expect(page.locator("#active-filters-inline")).toContainText("Tag: discovery");
  await expect(page.locator("#center-view")).toContainText("Terms Aggregation");
  await expect(page.locator("#center-view")).not.toContainText("No matches found");
});

test("deep-linked docs page keeps the search shell after a hard load", async ({ page }) => {
  await page.goto("/docs/discovery/terms-aggregation/");

  await expect(page.locator("#query")).toBeVisible();
  await expect(page.locator(".reader-sidebar")).toBeVisible();
  await expect(page.locator(".reader-facets")).toBeVisible();
  await expect(page.locator("#center-view")).toContainText("Terms Aggregation");
});

test("doc links navigate without triggering a hard reload", async ({ page }) => {
  await page.goto("/docs/overview/what-querylight-ts-covers/");

  await expect(page.locator("#center-view")).toContainText("What Querylight TS Covers");
  await page.evaluate(() => {
    window.sessionStorage.removeItem("querylight-hard-nav");
    window.addEventListener("beforeunload", () => {
      window.sessionStorage.setItem("querylight-hard-nav", "1");
    }, { once: true });
  });

  await page.locator("#center-view").getByRole("link", { name: "How To Build Faceted Navigation" }).click();

  await expect(page).toHaveURL(/\/docs\/guides\/how-to-build-faceted-navigation\/$/);
  await expect(page.locator("#center-view")).toContainText("How To Build Faceted Navigation");
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("querylight-hard-nav"))).toBeNull();
});

test("docs search header link navigates home without triggering a hard reload", async ({ page }) => {
  await page.goto("/docs/overview/what-querylight-ts-covers/");

  await expect(page.locator("#center-view")).toContainText("What Querylight TS Covers");
  await page.evaluate(() => {
    window.sessionStorage.removeItem("querylight-hard-nav");
    window.addEventListener("beforeunload", () => {
      window.sessionStorage.setItem("querylight-hard-nav", "1");
    }, { once: true });
  });

  await page.locator("#demo-shell").getByRole("link", { name: "Docs Search" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#center-view")).toContainText("Explore the docs");
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("querylight-hard-nav"))).toBeNull();
});

test("dashboard header link navigates to docs search without triggering a hard reload", async ({ page }) => {
  await page.goto("/dashboard/");

  await expect(page.locator("#app")).toContainText("Querylight TS Dashboard Demo");
  await page.evaluate(() => {
    window.sessionStorage.removeItem("querylight-hard-nav");
    window.addEventListener("beforeunload", () => {
      window.sessionStorage.setItem("querylight-hard-nav", "1");
    }, { once: true });
  });

  await page.locator("#app").getByRole("link", { name: "Docs Search" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#center-view")).toContainText("Explore the docs");
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("querylight-hard-nav"))).toBeNull();
});

test("api reference header link navigates without triggering a hard reload", async ({ page }) => {
  await page.goto("/docs/overview/what-querylight-ts-covers/");

  await expect(page.locator("#center-view")).toContainText("What Querylight TS Covers");
  await page.evaluate(() => {
    window.sessionStorage.removeItem("querylight-hard-nav");
    window.addEventListener("beforeunload", () => {
      window.sessionStorage.setItem("querylight-hard-nav", "1");
    }, { once: true });
  });

  await page.locator("#demo-shell").getByRole("link", { name: "API Reference" }).click();

  await expect(page).toHaveURL(/\/docs\/api\/$/);
  await expect(page.locator("#center-view")).toContainText("Generated symbol-level API documentation");
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem("querylight-hard-nav"))).toBeNull();
});

test("api reference pages appear in search and section facets", async ({ page }) => {
  await page.goto("/");

  await page.locator("#query").fill("createSimpleTextSearchIndex");
  await page.locator("#submit-query").click();

  await expect(page.locator("#result-count")).toContainText(/matches/);
  await expect(page.locator("#center-view")).toContainText("createSimpleTextSearchIndex");
  await expect(page.locator("#facet-sections")).toContainText("API Reference");
});

test("search results support paging and expose offset metadata", async ({ page }) => {
  await page.goto("/");

  await page.locator("#query").fill("search");
  await page.locator("#submit-query").click();

  const resultCount = page.locator("#result-count");
  await expect(resultCount).toContainText(/\d+ matches · \d+ ms · showing 1-20/);

  const nextButton = page.getByRole("button", { name: "Next" });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(resultCount).toContainText(/offset 20/);
  await expect(resultCount).toContainText(/showing 21-/);
  await expect(page.locator("#center-view .nav-result").first()).toContainText(/21\./);

  const previousButton = page.getByRole("button", { name: "Previous" });
  await expect(previousButton).toBeEnabled();
  await previousButton.click();

  await expect(resultCount).not.toContainText("offset 20");
  await expect(resultCount).toContainText(/showing 1-20/);
  await expect(page.locator("#center-view .nav-result").first()).toContainText(/1\./);
});

test("all documentation view paginates beyond the first 20 docs", async ({ page }) => {
  await page.goto("/");

  await page.locator("#submit-query").click();

  const resultCount = page.locator("#result-count");
  await expect(resultCount).toContainText(/\d+ matches · \d+ ms · showing 1-20/);

  const nextButton = page.getByRole("button", { name: "Next" });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(resultCount).toContainText(/offset 20/);
  await expect(resultCount).toContainText(/showing 21-40/);
});

test("all documentation view does not show significant term suggestions", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#facet-sections")).toContainText("Do a lexical search to get significant terms.");
  await expect(page.locator('#facet-sections [data-example]')).toHaveCount(0);
});

test("ask the docs returns semantic matches with backend fallback messaging", async ({ page }) => {
  await page.goto("/");

  await page.locator("#experience-ask").click();
  await page.locator("#query").fill("how do I use vector search");
  await page.locator("#submit-query").click();

  const centerView = page.locator("#center-view");
  await expect(centerView).toContainText("Ask The Docs", { timeout: 20_000 });
  await expect(centerView).toContainText(/semantic matches/i, { timeout: 20_000 });
  await expect(centerView).toContainText(/WebGPU|CPU fallback/, { timeout: 20_000 });
  await expect.poll(async () => centerView.locator('[data-open-doc="true"]').count()).toBeGreaterThan(0);
});

test("ask the docs jump to section keeps the current docs page", async ({ page }) => {
  await page.goto("/");

  await page.locator("#experience-ask").click();
  await page.locator("#query").fill("how do I use vector search");
  await page.locator("#submit-query").click();

  const centerView = page.locator("#center-view");
  await expect(centerView).toContainText("Ask The Docs", { timeout: 20_000 });

  const firstResult = centerView.locator('[data-open-doc="true"]').first();
  await firstResult.click();

  await expect(page).toHaveURL(/\/docs\/.+#chunk-anchor-/);
  await expect(centerView).toContainText("Jump to section");

  const currentPath = new URL(page.url()).pathname;
  await centerView.getByRole("link", { name: "Jump to section" }).click();

  await expect(page).toHaveURL(new RegExp(`${currentPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}#chunk-anchor-`));
  await expect(centerView).not.toContainText("Explore the docs");
});

test("narrower text queries still show significant term suggestions", async ({ page }) => {
  await page.goto("/");

  await page.locator("#query").fill("semantic");
  await page.locator("#submit-query").click();

  await expect(page.locator("#result-count")).toContainText(/matches/);
  await expect.poll(async () => page.locator('#facet-sections [data-example]').count()).toBeGreaterThan(0);
});

test("mobile TOC panel opens as a full-height sheet above the footer", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto("/");

  await page.getByRole("button", { name: "Browse docs" }).click();

  const readerLayout = page.locator("#reader-layout");
  const sidebar = page.locator(".reader-sidebar");
  const overlay = page.locator("#reader-mobile-overlay");
  await expect(readerLayout).toHaveAttribute("data-mobile-panel", "toc");
  await expect(sidebar).toBeVisible();
  await expect(overlay).toBeVisible();

  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error("Viewport size is not available");
  }

  const sidebarBox = await sidebar.boundingBox();
  if (!sidebarBox) {
    throw new Error("Sidebar bounding box is not available");
  }

  expect(sidebarBox.height).toBeGreaterThanOrEqual(viewport.height - 80);
  expect(sidebarBox.y).toBeLessThan(viewport.height * 0.1);
});
