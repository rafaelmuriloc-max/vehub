import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanyTab } from '@/components/settings/CompanyTab';
import { DepartmentsTab } from '@/components/settings/DepartmentsTab';
import { PartnersTab } from '@/components/settings/PartnersTab';
import { UsersTab } from '@/components/settings/UsersTab';
import { TriageTrainingTab } from '@/components/settings/TriageTrainingTab';
import { DriveSyncTab } from '@/components/settings/DriveSyncTab';
import { ClientAccessTab } from '@/components/settings/ClientAccessTab';
import { useAuth } from '@/hooks/useAuth';

export default function Settings() {
  const { isAdmin } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Meu Escritório</h1>
      <Tabs defaultValue="company" className="w-full">
        <TabsList className={isAdmin ? 'flex w-full flex-wrap h-auto' : 'grid w-full grid-cols-5'}>
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="departments">Departamentos</TabsTrigger>
          <TabsTrigger value="partners">Sócios</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="triage">Treinamento Gisele</TabsTrigger>
          {isAdmin && <TabsTrigger value="drive">Drive</TabsTrigger>}
          {isAdmin && <TabsTrigger value="portal">Acessos de Clientes</TabsTrigger>}
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="partners"><PartnersTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="triage"><TriageTrainingTab /></TabsContent>
        {isAdmin && <TabsContent value="drive"><DriveSyncTab /></TabsContent>}
        {isAdmin && <TabsContent value="portal"><ClientAccessTab /></TabsContent>}
      </Tabs>
    </div>
  );
}
