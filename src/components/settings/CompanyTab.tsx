import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface CompanyData {
  id?: string;
  company_name: string;
  cnpj: string;
  serpro_cnpj: string;
  address: string;
  phone: string;
  email: string;
}

export function CompanyTab() {
  const { isAdmin: admin } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<CompanyData>({
    company_name: '', cnpj: '', address: '', phone: '', email: '',
  });

  useEffect(() => {
    supabase.from('company_settings').select('*').limit(1).single().then(({ data: row }) => {
      if (row) setData(row as unknown as CompanyData);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = data.id
      ? await supabase.from('company_settings').update(data).eq('id', data.id)
      : await supabase.from('company_settings').insert(data);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Dados salvos com sucesso' });
      // refetch to get id
      const { data: row } = await supabase.from('company_settings').select('*').limit(1).single();
      if (row) setData(row as unknown as CompanyData);
    }
  };

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  const fields: { key: keyof CompanyData; label: string }[] = [
    { key: 'company_name', label: 'Razão Social' },
    { key: 'cnpj', label: 'CNPJ' },
    { key: 'address', label: 'Endereço' },
    { key: 'phone', label: 'Telefone' },
    { key: 'email', label: 'Email' },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Dados da Empresa</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {fields.map(f => (
          <div key={f.key} className="space-y-1">
            <Label>{f.label}</Label>
            <Input
              value={(data[f.key] as string) || ''}
              onChange={e => setData({ ...data, [f.key]: e.target.value })}
              disabled={!admin}
            />
          </div>
        ))}
        {admin && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
