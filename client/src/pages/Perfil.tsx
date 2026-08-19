import React, { useRef, useState } from "react";
import { Camera, Save, KeyRound, Trash2 } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Field, Input } from "../components/ui/Form";
import { ConfirmDialog } from "../components/ui/Modal";
import { formatDateTime } from "../lib/format";

export default function Perfil() {
  usePageHeader({ title: "Meu Perfil" });
  const { user, refreshMe, logout } = useAuth();
  const { notify } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [deleteStep, setDeleteStep] = useState(0);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put("/profile", { name, username, email });
      await refreshMe();
      notify("Dados atualizados com sucesso.");
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      await api.post("/profile/photo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      await refreshMe();
      notify("Foto de perfil atualizada com sucesso.");
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      notify("A confirmação da nova senha não confere.", "error");
      return;
    }
    setSavingPassword(true);
    try {
      await api.put("/profile/password", { current_password: currentPassword, new_password: newPassword });
      notify("Senha alterada com sucesso.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete("/profile", { data: { password: deletePassword, confirm: true } });
      notify("Conta excluída com sucesso.");
      logout();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <Card title="Dados do perfil">
        <div className="flex items-center gap-4 mb-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-[var(--brand-1)]/15 text-[var(--brand-1)] flex items-center justify-center text-lg font-semibold overflow-hidden">
              {user?.photo_url ? <img src={user.photo_url} className="w-full h-full object-cover" /> : user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--brand-1)] text-white flex items-center justify-center"
            >
              <Camera size={12} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div className="text-xs text-[var(--text-muted)] space-y-0.5">
            <p>Cargo: <span className="text-[var(--text-secondary)]">{user?.position || "-"}</span></p>
            <p>Setor: <span className="text-[var(--text-secondary)]">{user?.sector || "-"}</span></p>
            <p>Perfil de acesso: <span className="text-[var(--text-secondary)] capitalize">{user?.role}</span></p>
            <p>Cadastrado em: <span className="text-[var(--text-secondary)]">{formatDateTime(user?.created_at)}</span></p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="grid sm:grid-cols-2 gap-3">
          <Field label="Nome completo" required><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Usuário" required><Input required value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
          <Field label="E-mail" required><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="sm:col-span-2" /></Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={savingProfile}><Save size={15} /> {savingProfile ? "Salvando..." : "Salvar alterações"}</Button>
          </div>
        </form>
      </Card>

      <Card title="Alterar senha">
        <form onSubmit={handleChangePassword} className="grid sm:grid-cols-3 gap-3">
          <Field label="Senha atual" required><Input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></Field>
          <Field label="Nova senha" required><Input type="password" required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></Field>
          <Field label="Confirmar nova senha" required><Input type="password" required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></Field>
          <div className="sm:col-span-3 flex justify-end">
            <Button type="submit" disabled={savingPassword}><KeyRound size={15} /> {savingPassword ? "Alterando..." : "Alterar senha"}</Button>
          </div>
        </form>
      </Card>

      <Card title="Excluir conta" className="border-[var(--status-critical)]/30">
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Ao excluir sua conta, seu acesso será desativado. Registros históricos vinculados ao seu usuário são preservados por exigirem autorização administrativa para remoção definitiva.
        </p>
        <Button variant="danger" onClick={() => setDeleteStep(1)}>
          <Trash2 size={15} /> Excluir minha conta
        </Button>
      </Card>

      <ConfirmDialog
        open={deleteStep === 1}
        onClose={() => setDeleteStep(0)}
        onConfirm={() => setDeleteStep(2)}
        title="Confirmar exclusão de conta"
        message="Tem certeza de que deseja excluir sua conta? Esta ação desativará seu acesso ao sistema."
        confirmLabel="Continuar"
      />

      {deleteStep === 2 && (
        <ConfirmDialogWithPassword
          onCancel={() => setDeleteStep(0)}
          onConfirm={handleDeleteAccount}
          password={deletePassword}
          setPassword={setDeletePassword}
          loading={deleting}
        />
      )}
    </div>
  );
}

function ConfirmDialogWithPassword({
  onCancel,
  onConfirm,
  password,
  setPassword,
  loading,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  password: string;
  setPassword: (v: string) => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative w-full max-w-sm card-surface rounded-xl shadow-2xl p-5">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Confirmação final</h2>
        <p className="text-xs text-[var(--text-secondary)] mb-3">Digite sua senha atual para confirmar a exclusão definitiva da conta.</p>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha atual" autoFocus />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="text-sm px-3.5 py-2 rounded-lg border border-[var(--border-hairline)]">Cancelar</button>
          <button
            onClick={onConfirm}
            disabled={loading || !password}
            className="text-sm px-3.5 py-2 rounded-lg text-white bg-[var(--status-critical)] disabled:opacity-50"
          >
            {loading ? "Excluindo..." : "Excluir definitivamente"}
          </button>
        </div>
      </div>
    </div>
  );
}
