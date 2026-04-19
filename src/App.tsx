/**
 * [WHO]: 提供 App 主应用组件，包含路由和 Studio 工作台
 * [FROM]: 依赖页面组件、StudioPage、React Router
 * [TO]: 被 main.tsx 挂载到 DOM
 * [HERE]: src/App.tsx — 路由入口
 */
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "./components/pages/LandingPage";
import { LoginPage } from "./components/pages/LoginPage";
import { BookReaderPage } from "./components/pages/BookReaderPage";
import { StudioPage } from "./StudioPage";

/* ─── Protected Route wrapper ─── */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = localStorage.getItem("membook.auth") === "admin";
  if (!isAuthenticated) {
    window.location.href = "/login";
    return null;
  }
  return <>{children}</>;
}

/* ─── Router root ─── */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/login"
          element={<LoginPage onLogin={() => (window.location.href = "/studio")} />}
        />
        <Route
          path="/book/:id"
          element={
            <ProtectedRoute>
              <BookReaderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <StudioPage onLogout={() => (window.location.href = "/")} />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <StudioPage onLogout={() => (window.location.href = "/")} />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
