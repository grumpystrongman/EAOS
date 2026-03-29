import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import { APP_ROUTES } from "./app/routes.js";

const Placeholder = ({ title }: { title: string }) => (
  <main style={{ padding: 24, fontFamily: "'IBM Plex Sans', sans-serif" }}>
    <h1>{title}</h1>
    <p>Role-aware evidence-rich view placeholder.</p>
  </main>
);

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  ...APP_ROUTES.map((route) => ({
    path: route.path,
    element: <Placeholder title={route.title} />
  }))
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);