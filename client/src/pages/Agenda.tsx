import React, { useEffect, useState, useCallback } from "react";
import { Plus, ChevronLeft, ChevronRight, MapPin, Users, Clock, Pencil, Trash2, CalendarDays } from "lucide-react";
import { api, apiErrorMessage } from "../lib/api";
import { usePageHeader } from "../contexts/PageHeaderContext";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal, ConfirmDialog } from "../components/ui/Modal";
import { Field, Input, Textarea } from "../components/ui/Form";
import { formatDate } from "../lib/format";

interface AgendaEvent {
  id: number;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  participants: string | null;
  description: string | null;
}

type ViewMode = "dia" | "semana" | "mes" | "lista";

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}
function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = x.getDay();
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const emptyForm = { title: "", event_date: iso(new Date()), start_time: "", end_time: "", location: "", participants: "", description: "" };

export default function Agenda() {
  const { hasRole } = useAuth();
  const { notify } = useToast();
  const canWrite = hasRole("administrador", "gestor");
  const [view, setView] = useState<ViewMode>("semana");
  const [ref, setRef] = useState<Date>(new Date());
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [upcoming, setUpcoming] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AgendaEvent | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgendaEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  usePageHeader({ title: "Agenda Corporativa" });

  const range = useCallback((): { from: string; to: string } => {
    if (view === "dia") return { from: iso(ref), to: iso(ref) };
    if (view === "semana") { const s = startOfWeek(ref); return { from: iso(s), to: iso(addDays(s, 6)) }; }
    if (view === "mes") {
      const s = new Date(ref.getFullYear(), ref.getMonth(), 1);
      const e = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
      return { from: iso(s), to: iso(e) };
    }
    // lista: próximos 60 dias a partir de hoje
    return { from: iso(new Date()), to: iso(addDays(new Date(), 60)) };
  }, [view, ref]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = range();
      const [rangeRes, upRes] = await Promise.all([
        api.get("/agenda/range/list", { params: { from, to } }),
        api.get("/agenda/upcoming"),
      ]);
      setEvents(rangeRes.data.data);
      setUpcoming(upRes.data.data);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const shift = (dir: number) => {
    if (view === "dia") setRef((d) => addDays(d, dir));
    else if (view === "semana") setRef((d) => addDays(d, dir * 7));
    else if (view === "mes") setRef((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));
  };

  const openCreate = (date?: string) => {
    setEditing(null);
    setForm({ ...emptyForm, event_date: date || iso(ref) });
    setModalOpen(true);
  };
  const openEdit = (ev: AgendaEvent) => {
    setEditing(ev);
    setForm({
      title: ev.title, event_date: ev.event_date, start_time: ev.start_time || "", end_time: ev.end_time || "",
      location: ev.location || "", participants: ev.participants || "", description: ev.description || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) { await api.put(`/agenda/${editing.id}`, form); notify("Compromisso atualizado."); }
      else { await api.post("/agenda", form); notify("Compromisso cadastrado."); }
      setModalOpen(false);
      load();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/agenda/${deleteTarget.id}`);
      notify("Compromisso excluído.");
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setDeleting(false);
    }
  };

  // agrupa por data
  const grouped = React.useMemo(() => {
    const map: Record<string, AgendaEvent[]> = {};
    events.forEach((e) => { (map[e.event_date] ||= []).push(e); });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  const refLabel = () => {
    if (view === "dia") return ref.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
    if (view === "semana") { const s = startOfWeek(ref); return `${formatDate(iso(s))} — ${formatDate(iso(addDays(s, 6)))}`; }
    if (view === "mes") return ref.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return "Próximos 60 dias";
  };

  const VIEWS: { key: ViewMode; label: string }[] = [
    { key: "dia", label: "Dia" },
    { key: "semana", label: "Semana" },
    { key: "mes", label: "Mês" },
    { key: "lista", label: "Lista" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[var(--border-hairline)] overflow-hidden">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`px-3 py-1.5 text-sm ${view === v.key ? "bg-[var(--brand-1)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-1)]"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {canWrite && (
          <Button onClick={() => openCreate()}>
            <Plus size={16} /> Novo compromisso
          </Button>
        )}
      </div>

      {view !== "lista" && (
        <div className="flex items-center gap-3">
          <button onClick={() => shift(-1)} className="p-1.5 rounded-md border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]"><ChevronLeft size={16} /></button>
          <button onClick={() => setRef(new Date())} className="text-xs px-3 py-1.5 rounded-md border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]">Hoje</button>
          <button onClick={() => shift(1)} className="p-1.5 rounded-md border border-[var(--border-hairline)] hover:bg-[var(--surface-1)]"><ChevronRight size={16} /></button>
          <span className="text-sm font-medium text-[var(--text-primary)] capitalize">{refLabel()}</span>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <Card><p className="text-sm text-[var(--text-muted)] py-6 text-center">Carregando...</p></Card>
          ) : grouped.length === 0 ? (
            <Card>
              <div className="flex flex-col items-center gap-2 py-10 text-[var(--text-muted)]">
                <CalendarDays size={28} />
                <p className="text-sm">Nenhum compromisso neste período.</p>
              </div>
            </Card>
          ) : (
            grouped.map(([date, evs]) => (
              <Card key={date} title={formatDate(date)}>
                <div className="space-y-2">
                  {evs.map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3 rounded-lg border border-[var(--border-hairline)] p-3">
                      <div className="text-xs font-semibold text-[var(--brand-1)] shrink-0 w-24">
                        {ev.start_time ? (
                          <span className="inline-flex items-center gap-1"><Clock size={12} /> {ev.start_time}{ev.end_time ? `–${ev.end_time}` : ""}</span>
                        ) : "Dia todo"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--text-primary)]">{ev.title}</p>
                        {ev.location && <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5"><MapPin size={12} /> {ev.location}</p>}
                        {ev.participants && <p className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5"><Users size={12} /> {ev.participants}</p>}
                        {ev.description && <p className="text-xs text-[var(--text-secondary)] mt-1">{ev.description}</p>}
                      </div>
                      {canWrite && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEdit(ev)} className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--brand-1)] hover:bg-[var(--brand-1)]/10"><Pencil size={13} /></button>
                          <button onClick={() => setDeleteTarget(ev)} className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--status-critical)] hover:bg-[var(--status-critical)]/10"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            ))
          )}
        </div>

        <div>
          <Card title="Próximos compromissos" subtitle="Lembretes dos próximos 7 dias">
            {upcoming.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)] py-2">Nada agendado para os próximos dias.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-[var(--border-hairline)] p-2.5">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{ev.title}</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {formatDate(ev.event_date)}{ev.start_time ? ` · ${ev.start_time}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-[var(--text-muted)] mt-3 pt-3 border-t border-[var(--border-hairline)]">
              Os compromissos aparecem aqui como lembrete antecipado (24h, 1h e 15 min antes serão sinalizados no sistema).
            </p>
          </Card>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Editar compromisso" : "Novo compromisso"} width="max-w-2xl">
        <form onSubmit={handleSave} className="space-y-3">
          <Field label="Título" required>
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Data" required>
              <Input type="date" required value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </Field>
            <Field label="Hora inicial">
              <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </Field>
            <Field label="Hora final">
              <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </Field>
          </div>
          <Field label="Local">
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </Field>
          <Field label="Participantes">
            <Input value={form.participants} onChange={(e) => setForm({ ...form, participants: e.target.value })} placeholder="Ex: equipe SUAC, gestores..." />
          </Field>
          <Field label="Descrição">
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
