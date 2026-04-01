import { Card, CardContent } from '@/components/ui/card';
import { ShoppingCart } from 'lucide-react';

export default function NfceTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">NFC-e — Em breve</h2>
          <p className="text-muted-foreground max-w-md">
            A consulta e gestão de Notas Fiscais de Consumidor Eletrônicas estará disponível em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
