import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SerecPage from "./pages/serec/SerecPage";
import SuacPage from "./pages/suac/SuacPage";
import SetipPage from "./pages/setip/SetipPage";
import SeppertPage from "./pages/seppert/SeppertPage";
import Colaboradores from "./pages/Colaboradores";
import Gestores from "./pages/Gestores";
import Patrimonios from "./pages/Patrimonios";
import Usuarios from "./pages/Usuarios";
import Relatorios from "./pages/Relatorios";
import Auditoria from "./pages/Auditoria";
import Perfil from "./pages/Perfil";
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/serec" element={<SerecPage />} />
                <Route path="/suac" element={<SuacPage />} />
                <Route path="/setip" element={<SetipPage />} />
                <Route path="/seppert" element={<SeppertPage />} />
                <Route path="/colaboradores" element={<Colaboradores />} />
                <Route path="/gestores" element={<Gestores />} />
                <Route path="/patrimonios" element={<Patrimonios />} />
                <Route
                  path="/usuarios"
                  element={
                    <ProtectedRoute roles={["administrador"]}>
                      <Usuarios />
                    </ProtectedRoute>
                  }
                />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route
                  path="/auditoria"
                  element={
                    <ProtectedRoute roles={["administrador"]}>
                      <Auditoria />
                    </ProtectedRoute>
                  }
                />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/perfil" element={<Perfil />} />
              </Route>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
