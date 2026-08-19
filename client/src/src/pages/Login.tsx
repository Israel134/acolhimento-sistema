import React, { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Eye, EyeOff, HeartPulse, LogIn } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiErrorMessage, api } from "../lib/api";
import { Input, Field } from "../components/ui/Form";
import { Button } from "../components/ui/Button";

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");

  if (!loading && user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!identifier || !password) {
      setError("Informe usuário/e-mail e senha.");
      return;
    }
    setSubmitting(true);
    try {
      await login(identifier, password);
      navigate("/dashboard");
    } catch (err: any) {
      setError(apiErrorMessage(err, "Não foi possível entrar. Verifique suas credenciais."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async () => {
    try {
      const res = await api.post("/auth/forgot-password", { identifier });
      setForgotMsg(res.data.message);
    } catch {
      setForgotMsg("Se o usuário existir, enviaremos instruções para o e-mail cadastrado.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--surface-page)] p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[var(--brand-1)] flex items-center justify-center text-white mb-3">
            <HeartPulse size={24} />
          </div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">Sistema de Gestão de Acolhimento</h1>
          <p className="text-xs text-[var(--text-muted)] mt-1">SEREC · SUAC · SETIP · SEPPERT</p>
        </div>

        <form onSubmit={handleSubmit} className="card-surface rounded-xl p-5 sm:p-6 space-y-4">
          <Field label="Usuário ou e-mail" required>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="ex: admin"
              autoComplete="username"
              autoFocus
            />
          </Field>
          <Field label="Senha" required>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </Field>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Manter sessão
            </label>
            <button type="button" onClick={() => setForgotOpen((v) => !v)} className="text-[var(--brand-1)] font-medium">
              Esqueci minha senha
            </button>
          </div>

          {forgotOpen && (
            <div className="rounded-lg border border-[var(--border-hairline)] p-3 text-xs text-[var(--text-secondary)] space-y-2">
              <p>Informe seu usuário ou e-mail acima e clique em enviar para receber instruções de redefinição.</p>
              <Button type="button" size="sm" variant="secondary" onClick={handleForgot}>
                Enviar instruções
              </Button>
              {forgotMsg && <p className="text-[var(--status-good)]">{forgotMsg}</p>}
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-[var(--status-critical)]/10 text-[var(--status-critical)] text-xs px-3 py-2">
              {error}
            </div>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            <LogIn size={16} /> {submitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="mt-4 text-center text-[11px] text-[var(--text-muted)]">
          Demonstração: admin / Acolher@123
        </div>
      </div>
    </div>
  );
}
