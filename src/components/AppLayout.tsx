import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { useChatNotification } from '@/hooks/useChatNotification';

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
  useChatNotification();

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const pageTitle = pageTitles[location.pathname] || '';

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 flex h-12 items-center gap-2 border-b border-border bg-background px-4 md:hidden">
            <SidebarTrigger />
            <span className="text-sm font-medium text-foreground">{pageTitle}</span>
          </header>
          <div className={location.pathname === '/chat' ? 'h-full' : 'p-6'}>
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
