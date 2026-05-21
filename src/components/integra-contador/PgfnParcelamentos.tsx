import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function PgfnParcelamentos() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            Parcelamentos PGFN
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            A PGFN não disponibiliza serviço público no Integra Contador SERPRO.
            A consulta de parcelamentos PGFN exige automação no portal{' '}
            <a
              href="https://www.regularize.pgfn.gov.br"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              REGULARIZE
            </a>{' '}
            usando o certificado e-CNPJ do cliente.
          </p>
          <p>
            Esta automação está em construção. Será disponibilizada após
            configuração do proxy de scraping autenticado
            (<code className="text-xs">PGFN_PROXY_URL</code>).
          </p>
          <p>
            Enquanto isso, acesse o REGULARIZE manualmente para emitir guias
            DARF de parcelamentos PGFN.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}