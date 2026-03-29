import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import { APP_ROUTES } from "./app/routes.js";
import { App } from "./app/App.js";
import "./styles.css";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  ...APP_ROUTES.map((route) => ({ path: route.path, element: <App /> }))
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);