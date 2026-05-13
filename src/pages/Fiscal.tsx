import SituacaoFiscalTab from '@/components/integra-contador/SituacaoFiscalTab';

export default function Fiscal() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Fiscal</h1>
        <p className="text-muted-foreground mt-1">
          Situação fiscal dos clientes junto à Receita Federal
        </p>
      </div>
      <SituacaoFiscalTab />
    </div>
  );
}
