import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Receipt, ShoppingCart } from 'lucide-react';
import NfseTab from '@/components/invoices/NfseTab';
import NfeTab from '@/components/invoices/NfeTab';
import NfceTab from '@/components/invoices/NfceTab';

export default function Invoices() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Notas Fiscais</h1>
        <p className="text-muted-foreground">Consulta e gestão de documentos fiscais eletrônicos</p>
      </div>

      <Tabs defaultValue="nfse" className="w-full">
        <TabsList>
          <TabsTrigger value="nfse" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            NFS-e
          </TabsTrigger>
          <TabsTrigger value="nfe" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            NF-e
          </TabsTrigger>
          <TabsTrigger value="nfce" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            NFC-e
          </TabsTrigger>
        </TabsList>

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
