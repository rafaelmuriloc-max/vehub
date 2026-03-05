import { DocumentTypesTab } from '@/components/settings/DocumentTypesTab';

export default function DocumentTypes() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Tipos de Documento</h1>
      <DocumentTypesTab />
    </div>
  );
}
