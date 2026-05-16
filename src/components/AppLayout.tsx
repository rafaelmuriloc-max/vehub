import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Separator } from '@/components/ui/separator';
import { useChatNotification } from '@/hooks/useChatNotification';

const pageTitles: Record<string, string> = {
  '/': 'Financeiro',
  '/clients': 'Clientes',
  '/invoices': 'Notas Fiscais',
  '/invoices/emit': 'Emitir NFS-e',
  '/fiscal': 'Fiscal',
  '/integra-contador': 'Integra Contador',
  '/calendar': 'Calendário',
  '/settings': 'Configurações',
  '/settings/document-types': 'Tipos de Documento',
  '/obligations': 'Obrigações',
};

export function AppLayout() {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  useChatNotification();

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><p className="text-muted-foreground">Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin && location.pathname === '/') {
    return <Navigate to="/calendar" replace />;
  }

  const pageTitle = pageTitles[location.pathname] || '';

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className={location.pathname === '/chat' ? 'flex-1 h-[100dvh] overflow-hidden' : 'flex-1 overflow-auto'}>
          {location.pathname !== '/chat' && (
          <header
            className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 md:hidden h-[calc(3rem+env(safe-area-inset-top))]"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <SidebarTrigger />
            <span className="text-sm font-medium text-foreground">{pageTitle}</span>
          </header>
          )}
          <div className={location.pathname === '/chat' ? 'h-full' : 'p-6'}>
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
