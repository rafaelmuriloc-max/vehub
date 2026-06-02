import { useEffect, useState } from 'react';
import { ClientsPanel } from '@/components/dashboard/ClientsPanel';
import { TasksPanel } from '@/components/dashboard/TasksPanel';
import { ObligationsPanel } from '@/components/dashboard/ObligationsPanel';
import { TicketsPanel } from '@/components/dashboard/TicketsPanel';

export default function Dashboard() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="h-full w-full overflow-auto bg-gradient-to-br from-background via-background to-card/30">
      <header className="flex items-center justify-between px-8 py-5 border-b border-border/40 sticky top-0 bg-background/80 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            <div className="w-1.5 h-7 rounded-full bg-primary" />
            <div className="w-1.5 h-9 rounded-full bg-primary" />
            <div className="w-1.5 h-6 rounded-full bg-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Painel da operação</h1>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Velocitä Contabilidade</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums leading-none">
            {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="text-xs text-muted-foreground capitalize mt-1">
            {now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </header>

      <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
        <ClientsPanel />
        <TasksPanel />
        <ObligationsPanel />
        <TicketsPanel />
      </div>
    </div>
  );
}