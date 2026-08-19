import { usePageHeader } from "../contexts/PageHeaderContext";
import { EmptyState } from "../components/ui/Tabs";

export function StubIndicatorPage({ title, message }: { title: string; message: string }) {
  usePageHeader({ title });
  return (
    <div className="space-y-4">
      <EmptyState title="Módulo em construção" message={message} />
    </div>
  );
}
