import { useState } from 'react';
import { Scale, Receipt, Plug, FolderOpen, Calculator } from 'lucide-react';
import SituacaoFiscalTab from '@/components/integra-contador/SituacaoFiscalTab';
import Invoices from './Invoices';
import IntegraContador from './IntegraContador';
import ParcelamentosTab from '@/components/integra-contador/ParcelamentosTab';
import SimplesNacionalTab from '@/components/simples-nacional/SimplesNacionalTab';
import { cn } from '@/lib/utils';

type View = 'situacao' | 'simples' | 'notas' | 'parcelamentos' | 'integra';

const ITEMS: { key: View; label: string; icon: any }[] = [
  { key: 'situacao', label: 'Situação Fiscal', icon: Scale },
  { key: 'simples', label: 'Simples Nacional', icon: Calculator },
  { key: 'notas', label: 'Notas Fiscais', icon: Receipt },
  { key: 'parcelamentos', label: 'Parcelamentos', icon: FolderOpen },
  { key: 'integra', label: 'Integra Contador', icon: Plug },
];

export default function Fiscal() {
  const [view, setView] = useState<View>('situacao');

  return (
    <div className="space-y-4">
      <nav className="flex justify-end gap-2 flex-wrap" aria-label="Módulos fiscais">
        {ITEMS.map(({ key, label, icon: Icon }) => {
          const active = view === key;
          return (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={cn(
                'inline-flex items-center gap-2 h-10 px-4 rounded-full border text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card text-foreground border-border hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </nav>

      {view === 'situacao' && <SituacaoFiscalTab />}
      {view === 'simples' && <SimplesNacionalTab />}
      {view === 'notas' && <Invoices />}
      {view === 'parcelamentos' && <ParcelamentosTab />}
      {view === 'integra' && <IntegraContador />}
    </div>
  );
}
