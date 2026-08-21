import React, { useState } from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, apiErrorMessage } from "../../lib/api";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; message: string }[];
  total: number;
}

export function ImportButton({
  resource,
  label = "Importar planilha",
  onDone,
}: {
  resource: string;
  label?: string;
  onDone?: () => void;
}) {
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const downloadTemplate = async () => {
    try {
      const res = await api.get(`/import/${resource}/template`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `modelo_${resource}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post(`/import/${resource}`, fd);
      setResult(res.data);
      if (res.data.imported > 0) {
        notify(`${res.data.imported} registro(s) importado(s) com sucesso.`);
        onDone?.();
      } else if (res.data.errors.length === 0 && res.data.skipped > 0) {
        notify("Nenhum registro novo — todos já existiam.", "error");
      }
    } catch (err: any) {
      notify(apiErrorMessage(err), "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const close = () => {
    setOpen(false);
    setResult(null);
    setFileName("");
  };

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload size={15} /> {label}
      </Button>

      <Modal open={open} onClose={close} title="Importar planilha" width="max-w-lg">
        <div className="space-y-4">
          <div className="rounded-lg border border-[var(--border-hairline)] p-3 space-y-2">
            <p className="text-sm text-[var(--text-secondary)]">
              Baixe o modelo, preencha com seus dados (uma linha por registro) e envie o arquivo.
              Aceita <strong>.xlsx</strong> (Excel) e <strong>.csv</strong>.
            </p>
            <Button variant="secondary" size="sm" onClick={downloadTemplate}>
              <Download size={14} /> Baixar modelo (CSV)
            </Button>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[var(--border-hairline)] p-6 cursor-pointer hover:bg-[var(--surface-1)]">
            <FileSpreadsheet size={28} className="text-[var(--text-muted)]" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {uploading ? "Importando..." : "Clique para escolher a planilha"}
            </span>
            {fileName && <span className="text-xs text-[var(--text-muted)]">{fileName}</span>}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>

          {result && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[var(--status-good)]/12 p-2">
                  <p className="text-lg font-semibold text-[var(--status-good)]">{result.imported}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Importados</p>
                </div>
                <div className="rounded-lg bg-[var(--status-warning)]/12 p-2">
                  <p className="text-lg font-semibold text-[var(--status-warning)]">{result.skipped}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Já existiam</p>
                </div>
                <div className="rounded-lg bg-[var(--status-critical)]/12 p-2">
                  <p className="text-lg font-semibold text-[var(--status-critical)]">{result.errors.length}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">Com erro</p>
                </div>
              </div>
              {result.errors.length === 0 ? (
                <p className="text-sm text-[var(--status-good)] flex items-center gap-1.5">
                  <CheckCircle2 size={15} /> Importação concluída sem erros.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto scrollbar-thin rounded-lg border border-[var(--border-hairline)] p-2 space-y-1">
                  {result.errors.map((er, i) => (
                    <p key={i} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                      <AlertTriangle size={13} className="text-[var(--status-critical)] shrink-0 mt-0.5" />
                      Linha {er.row}: {er.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={close}>Fechar</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
