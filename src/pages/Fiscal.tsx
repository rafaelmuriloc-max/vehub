import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Scale, Receipt, Plug, FolderOpen, Calculator } from 'lucide-react';
import SituacaoFiscalTab from '@/components/integra-contador/SituacaoFiscalTab';
import Invoices from './Invoices';
import IntegraContador from './IntegraContador';
import ParcelamentosTab from '@/components/integra-contador/ParcelamentosTab';
import SimplesNacionalTab from '@/components/simples-nacional/SimplesNacionalTab';

export default function Fiscal() {
  const [view, setView] = useState<'situacao' | 'simples' | 'notas' | 'parcelamentos' | 'integra'>('situacao');

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button
          variant={view === 'situacao' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('situacao')}
        >
          <Scale className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Situação Fiscal</span>
        </Button>
        <Button
          variant={view === 'simples' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('simples')}
        >
          <Calculator className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Simples Nacional</span>
        </Button>
        <Button
          variant={view === 'notas' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('notas')}
        >
          <Receipt className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Notas Fiscais</span>
        </Button>
        <Button
          variant={view === 'parcelamentos' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('parcelamentos')}
        >
          <FolderOpen className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Parcelamentos</span>
        </Button>
        <Button
          variant={view === 'integra' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setView('integra')}
        >
          <Plug className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Integra Contador</span>
        </Button>
      </div>

      {view === 'situacao' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fiscal</h1>
            <p className="text-muted-foreground mt-1">
              Situação fiscal dos clientes junto à Receita Federal
            </p>
          </div>
          <SituacaoFiscalTab />
        </div>
      )}
      {view === 'simples' && <SimplesNacionalTab />}
      {view === 'notas' && <Invoices />}
      {view === 'parcelamentos' && <ParcelamentosTab />}
      {view === 'integra' && <IntegraContador />}
    </div>
  );
}
