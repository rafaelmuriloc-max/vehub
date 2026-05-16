import { DollarSign, CheckSquare, Calendar, Building2, LogOut, FileText, ChevronRight, Scale, MessageCircle, Mail } from 'lucide-react';
import { useUnreadCount } from '@/hooks/useUnreadCount';
import { Badge } from '@/components/ui/badge';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarFooter, SidebarMenu, SidebarMenuItem,
  SidebarMenuButton, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar,
} from '@/components/ui/sidebar';

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

const menuItems = [
  { title: 'Fiscal', icon: Scale, path: '/fiscal' },
  { title: 'Chat', icon: MessageCircle, path: '/chat' },
  { title: 'E-mail', icon: Mail, path: '/email' },
  { title: 'Calendário', icon: Calendar, path: '/calendar' },
];

const cadastroSubItems = [
  { title: 'Clientes', path: '/clients' },
  { title: 'Meu Escritório', path: '/settings' },
  { title: 'Obrigações', path: '/obligations' },
  { title: 'Tipos de Documento', path: '/settings/document-types' },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut, isAdmin } = useAuth();
  const { setOpen, isMobile } = useSidebar();

  const isCadastroActive = cadastroSubItems.some(item => location.pathname === item.path);
  const unreadCount = useUnreadCount();

  const visibleMenuItems = menuItems;

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => { if (!isMobile) setOpen(true); }}
      onMouseLeave={() => { if (!isMobile) setOpen(false); }}
    >
      <SidebarHeader className="p-5 group-data-[collapsible=icon]:p-3 px-[20px]">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          {/* Velocitä logo mark – stylized bars */}
          <div className="flex gap-0.5">
            <div className="w-1 h-6 rounded-full bg-sidebar-primary" />
            <div className="w-1 h-8 rounded-full bg-sidebar-primary" />
            <div className="w-1 h-5 rounded-full bg-sidebar-primary" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="text-lg font-bold tracking-tight text-sidebar-foreground">Velocitä</h2>
            <p className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50 font-medium">Contabilidade</p>
          </div>
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border mx-0" />

      <SidebarContent className="pt-2 px-0">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest font-semibold">Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map(item => (
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

        <Separator className="bg-sidebar-border mx-0" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] uppercase tracking-widest font-semibold">Administração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={location.pathname === '/'}
                    onClick={() => navigate('/')}
                    className="transition-colors duration-150"
                  >
                    <DollarSign className="h-4 w-4" />
                    <span>Financeiro</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
