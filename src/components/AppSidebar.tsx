import { LayoutDashboard, Users, DollarSign, CheckSquare, Calendar, Building2, LogOut, FileText, ChevronRight, ClipboardList, FileType, Receipt, Scale } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { title: 'Clientes', icon: Users, path: '/clients' },
  { title: 'Financeiro', icon: DollarSign, path: '/financial' },
  { title: 'Documentos', icon: FileText, path: '/documents' },
  { title: 'Notas Fiscais', icon: Receipt, path: '/invoices' },
  { title: 'Fiscal', icon: Scale, path: '/fiscal' },
  { title: 'Tarefas', icon: CheckSquare, path: '/tasks' },
  { title: 'Calendário', icon: Calendar, path: '/calendar' },
];

const cadastroSubItems = [
  { title: 'Meu Escritório', path: '/settings' },
  { title: 'Obrigações', path: '/obligations' },
  { title: 'Tipos de Documento', path: '/settings/document-types' },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const isCadastroActive = cadastroSubItems.some(item => location.pathname === item.path);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <h2 className="text-lg font-bold text-foreground">Contábil Gestão</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton isActive={location.pathname === item.path} onClick={() => navigate(item.path)}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen={isCadastroActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={isCadastroActive}>
                      <Building2 className="h-4 w-4" />
                      <span>Cadastro</span>
                      <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {cadastroSubItems.map(item => (
                        <SidebarMenuSubItem key={item.path}>
                          <SidebarMenuSubButton
                            isActive={location.pathname === item.path}
                            onClick={() => navigate(item.path)}
                          >
                            <span>{item.title}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-foreground">{profile?.full_name || 'Usuário'}</p>
            <p className="text-xs text-muted-foreground truncate">{profile?.job_title || 'Funcionário'}</p>
          </div>
          <button onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
