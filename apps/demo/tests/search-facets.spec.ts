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
  await page.getByRole("button", { name: /Terms Aggregation and Significant Terms/i }).first().click();

  await expect(page.locator("#center-view")).toContainText("Terms Aggregation and Significant Terms");
  await page.locator("#center-view").getByRole("button", { name: "discovery", exact: true }).click();

  await expect(page.locator("#active-filters-inline")).toContainText("Tag: discovery");
  await expect(page.getByText(/results ·/i)).toBeVisible();
  await expect(page.locator("#center-view")).toContainText("Terms Aggregation and Significant Terms");
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
  await page.goto("/docs/discovery/terms-aggregation-and-significant-terms/");

  await page.getByRole("button", { name: "discovery", exact: true }).click();

  await expect(page.locator("#active-filters-inline")).toContainText("Tag: discovery");
  await expect(page.locator("#center-view")).toContainText("Terms Aggregation and Significant Terms");
  await expect(page.locator("#center-view")).not.toContainText("No matches found");
});

test("deep-linked docs page keeps the search shell after a hard load", async ({ page }) => {
  await page.goto("/docs/discovery/terms-aggregation-and-significant-terms/");

  await expect(page.locator("#query")).toBeVisible();
  await expect(page.locator(".reader-sidebar")).toBeVisible();
  await expect(page.locator(".reader-facets")).toBeVisible();
  await expect(page.locator("#center-view")).toContainText("Terms Aggregation and Significant Terms");
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
  await expect(resultCount).toContainText(/62 matches · \d+ ms · showing 1-20/);

  const nextButton = page.getByRole("button", { name: "Next" });
  await expect(nextButton).toBeEnabled();
  await nextButton.click();

  await expect(resultCount).toContainText(/offset 20/);
  await expect(resultCount).toContainText(/showing 21-40/);
});
