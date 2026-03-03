import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanyTab } from '@/components/settings/CompanyTab';
import { DepartmentsTab } from '@/components/settings/DepartmentsTab';
import { PartnersTab } from '@/components/settings/PartnersTab';
import { UsersTab } from '@/components/settings/UsersTab';
import { DocumentTypesTab } from '@/components/settings/DocumentTypesTab';

export default function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-foreground">Cadastro do Escritório</h1>
      <Tabs defaultValue="company" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="departments">Departamentos</TabsTrigger>
          <TabsTrigger value="partners">Sócios</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="document-types">Tipos de Documento</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="departments"><DepartmentsTab /></TabsContent>
        <TabsContent value="partners"><PartnersTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="document-types"><DocumentTypesTab /></TabsContent>
      </Tabs>
    </div>
  );
}
