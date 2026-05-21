import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import RfbParcelamentos from './RfbParcelamentos';
import PgfnParcelamentos from './PgfnParcelamentos';

export default function ParcelamentosTab() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Parcelamentos</h1>
        <p className="text-muted-foreground mt-1">
          Parcelamentos das empresas — Receita Federal (RFB) e Procuradoria (PGFN)
        </p>
      </div>

      <Tabs defaultValue="rfb" className="w-full">
        <TabsList>
          <TabsTrigger value="rfb">RFB</TabsTrigger>
          <TabsTrigger value="pgfn">PGFN</TabsTrigger>
        </TabsList>
        <TabsContent value="rfb" className="mt-4">
          <RfbParcelamentos />
        </TabsContent>
        <TabsContent value="pgfn" className="mt-4">
          <PgfnParcelamentos />
        </TabsContent>
      </Tabs>
    </div>
  );
}
