import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, ShieldCheck } from 'lucide-react';

export default function ChangePassword() {
  const { user, loading, profile } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (profile && !profile.must_change_password) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast({ title: 'Senha muito curta', description: 'A nova senha deve ter pelo menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (next !== confirm) {
      toast({ title: 'Senhas diferentes', description: 'A confirmação não confere com a nova senha.', variant: 'destructive' });
      return;
    }
    if (next === current) {
      toast({ title: 'Senha inválida', description: 'A nova senha deve ser diferente da temporária.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      // Valida a senha temporária recebida por WhatsApp
      const { error: checkErr } = await supabase.auth.signInWithPassword({
        email: user.email ?? '',
        password: current,
      });
      if (checkErr) {
        toast({ title: 'Senha temporária incorreta', description: 'Confira a senha recebida por WhatsApp.', variant: 'destructive' });
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: next });
      if (updateErr) {
        toast({ title: 'Erro', description: updateErr.message, variant: 'destructive' });
        return;
      }

      const { error: flagErr } = await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('user_id', user.id);
      if (flagErr) {
        toast({ title: 'Erro', description: flagErr.message, variant: 'destructive' });
        return;
      }

      toast({ title: 'Senha alterada', description: 'Sua nova senha já está ativa.' });
      navigate('/', { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-lg">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="flex flex-col items-center mb-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Alterar senha</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Você está usando a senha temporária recebida por WhatsApp. Crie sua nova senha para continuar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="current" className="text-sm font-medium">Senha temporária</Label>
              <Input id="current" type="password" value={current} onChange={e => setCurrent(e.target.value)} required placeholder="••••••" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next" className="text-sm font-medium">Nova senha</Label>
              <Input id="next" type="password" value={next} onChange={e => setNext(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-medium">Confirmar nova senha</Label>
              <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} placeholder="Repita a nova senha" />
            </div>
            <Button type="submit" className="w-full h-11 font-semibold" disabled={submitting}>
              {submitting ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Use uma senha forte, com letras maiúsculas, minúsculas e números. Ela é pessoal e não deve ser compartilhada.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
