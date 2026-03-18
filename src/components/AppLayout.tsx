import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clientes',
  '/financial': 'Financeiro',
  '/documents': 'Documentos',
  '/invoices': 'Notas Fiscais',
  '/invoices/emit': 'Emitir NFS-e',
  '/fiscal': 'Fiscal',
  '/integra-contador': 'Integra Contador',
  '/tasks': 'Tarefas',
  '/calendar': 'Calendário',
  '/settings': 'Configurações',
  '/settings/document-types': 'Tipos de Documento',
  '/obligations': 'Obrigações',
};

export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const pageTitle = pageTitles[location.pathname] || '';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-3 border-b bg-card px-6 py-3 shadow-sm">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
            <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
          </div>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
