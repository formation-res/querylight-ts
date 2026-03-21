import { mountDashboardApp } from "./dashboard-app";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  void mountDashboardApp(app);
}
