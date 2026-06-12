import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Copy, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

const WEBHOOK_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook`;

export function IntegrationsTab() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from('asaas_settings').select('*').limit(1).maybeSingle();
    setSettings(data); setLoading(false);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase.from('asaas_settings').update({
      environment: settings.environment,
      default_billing_type: settings.default_billing_type,
      default_due_days: settings.default_due_days,
      enabled: settings.enabled,
    }).eq('id', settings.id);
    setSaving(false);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else toast({ title: 'Configurações salvas' });
  }

  async function regenerateToken() {
    if (!confirm('Gerar novo token de webhook? O antigo deixará de funcionar imediatamente.')) return;
    const newToken = crypto.randomUUID();
    const { error } = await supabase.from('asaas_settings').update({ webhook_token: newToken }).eq('id', settings.id);
    if (error) toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    else { setSettings({ ...settings, webhook_token: newToken }); toast({ title: 'Novo token gerado' }); }
  }

  async function testConnection() {
    setTesting(true); setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('asaas-test-connection');
      if (error) throw error;
      if (data?.ok) setTestResult({ ok: true, msg: `Conectado em ${data.environment}. Saldo: R$ ${Number(data.balance?.totalBalance ?? 0).toFixed(2)}` });
      else setTestResult({ ok: false, msg: data?.error || 'Falha na conexão' });
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message });
    } finally { setTesting(false); }
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando...</div>;

  const webhookUrl = `${WEBHOOK_BASE}?token=${settings.webhook_token}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Integração Asaas</span>
            <div className="flex items-center gap-2">
              <Label htmlFor="enabled" className="text-sm">Ativada</Label>
              <Switch id="enabled" checked={settings.enabled} onCheckedChange={(v) => setSettings({ ...settings, enabled: v })} />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>Ambiente</Label>
              <Select value={settings.environment} onValueChange={(v) => setSettings({ ...settings, environment: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de cobrança padrão</Label>
              <Select value={settings.default_billing_type} onValueChange={(v) => setSettings({ ...settings, default_billing_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNDEFINED">Cliente escolhe</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Dias para vencimento</Label>
              <Input type="number" min={0} value={settings.default_due_days} onChange={(e) => setSettings({ ...settings, default_due_days: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            <Button variant="outline" onClick={testConnection} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Testar conexão
            </Button>
          </div>
          {testResult && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-md ${testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.msg}
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-md text-xs text-muted-foreground">
            <strong>API Keys:</strong> as chaves <code>ASAAS_API_KEY_SANDBOX</code> e <code>ASAAS_API_KEY_PRODUCTION</code> são armazenadas como secrets seguros no Supabase. Configure-as nas Settings de Edge Functions.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Webhook</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cole esta URL nas configurações de Webhook do Asaas (Configurações &gt; Integrações &gt; Webhooks). Eventos de pagamento atualizarão automaticamente os lançamentos.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast({ title: 'URL copiada' }); }}>
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={regenerateToken} title="Gerar novo token">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Eventos recomendados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, PAYMENT_DELETED, PAYMENT_REFUNDED.</p>
        </CardContent>
      </Card>
    </div>
  );
}