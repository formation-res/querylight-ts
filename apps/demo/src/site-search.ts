import { mountSearchApp } from "./search-app";

const app = document.querySelector<HTMLDivElement>("#app");

if (app) {
  void mountSearchApp(app);
}
