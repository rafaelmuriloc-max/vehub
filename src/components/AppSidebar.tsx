import { LayoutDashboard, Users, DollarSign, CheckSquare, Calendar, Building2, LogOut, FileText, ChevronRight, Receipt, Scale, Plug, MessageCircle, Mail } from 'lucide-react';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { title: 'Clientes', icon: Users, path: '/clients' },
  { title: 'Financeiro', icon: DollarSign, path: '/financial' },
  { title: 'Documentos', icon: FileText, path: '/documents' },
  { title: 'Notas Fiscais', icon: Receipt, path: '/invoices' },
  { title: 'Fiscal', icon: Scale, path: '/fiscal' },
  { title: 'Integra Contador', icon: Plug, path: '/integra-contador' },
  { title: 'Chat', icon: MessageCircle, path: '/chat' },
  { title: 'E-mail', icon: Mail, path: '/email' },
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
  const unreadCount = useUnreadCount();

  return (
    <Sidebar>
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          {/* Velocitä logo mark – stylized bars */}
          <div className="flex gap-0.5">
            <div className="w-1 h-6 rounded-full bg-sidebar-primary" />
            <div className="w-1 h-8 rounded-full bg-sidebar-primary" />
            <div className="w-1 h-5 rounded-full bg-sidebar-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-sidebar-foreground">Velocitä</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50 font-medium">Contabilidade</p>
          </div>
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border mx-3" />

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest font-semibold">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={location.pathname === item.path}
                    onClick={() => navigate(item.path)}
                    className="transition-colors duration-150"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                    {item.title === 'Chat' && unreadCount > 0 && (
                      <Badge className="ml-auto h-5 min-w-5 flex items-center justify-center px-1.5 text-[10px] font-bold bg-destructive text-destructive-foreground border-0">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="bg-sidebar-border mx-3" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest font-semibold">Administração</SidebarGroupLabel>
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
        <Separator className="bg-sidebar-border mb-4" />
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-sidebar-primary/60">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-semibold text-sm">
              {profile?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate text-sidebar-foreground">{profile?.full_name || 'Usuário'}</p>
            <p className="text-xs text-sidebar-foreground/50 truncate">{profile?.job_title || 'Funcionário'}</p>
          </div>
          <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-primary transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
