import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { FileText, Receipt, ShoppingCart, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import NfseTab from '@/components/invoices/NfseTab';
import NfeTab from '@/components/invoices/NfeTab';
import NfceTab from '@/components/invoices/NfceTab';

export default function Invoices() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('nfse');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notas Fiscais</h1>
          <p className="text-muted-foreground">Consulta e gestão de documentos fiscais eletrônicos</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border">
          <TabsList className="bg-transparent h-auto p-0 rounded-none gap-1 justify-start">
            <TabsTrigger
              value="nfse"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground"
            >
              <FileText className="h-4 w-4" />
              NFS-e
            </TabsTrigger>
            <TabsTrigger
              value="nfe"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground"
            >
              <Receipt className="h-4 w-4" />
              NF-e
            </TabsTrigger>
            <TabsTrigger
              value="nfce"
              className="flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground"
            >
              <ShoppingCart className="h-4 w-4" />
              NFC-e
            </TabsTrigger>
          </TabsList>
          {isAdmin && tab === 'nfse' && (
            <Button onClick={() => navigate('/invoices/emit')} className="sm:mb-1">
              <Plus className="h-4 w-4 mr-2" />
              Emitir NFS-e
            </Button>
          )}
        </div>

        <TabsContent value="nfse">
          <NfseTab />
        </TabsContent>
        <TabsContent value="nfe">
          <NfeTab />
        </TabsContent>
        <TabsContent value="nfce">
          <NfceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
