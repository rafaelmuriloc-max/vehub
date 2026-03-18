import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const { user, loading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><p>Carregando...</p></div>;
  if (user) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = isLogin
      ? await signIn(email, password)
      : await signUp(email, password, fullName);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else if (!isLogin) {
      toast({ title: 'Sucesso', description: 'Verifique seu email para confirmar o cadastro.' });
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary/10" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary/5" />

        <div className="relative z-10 max-w-md text-center">
          {/* Logo mark */}
          <div className="flex items-center justify-center gap-1 mb-8">
            <div className="w-2 h-10 rounded-full bg-primary" />
            <div className="w-2 h-14 rounded-full bg-primary" />
            <div className="w-2 h-8 rounded-full bg-primary" />
          </div>
          <h1 className="text-4xl font-bold text-secondary-foreground mb-3 tracking-tight">Velocitä</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-secondary-foreground/50 font-medium mb-8">Contabilidade</p>
          <p className="text-lg text-secondary-foreground/70 leading-relaxed">
            Gestão contábil inteligente para o seu escritório. Agilidade, controle e resultados.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="pt-8 pb-8 px-8">
            {/* Mobile logo */}
            <div className="lg:hidden flex items-center justify-center gap-1 mb-6">
              <div className="w-1.5 h-7 rounded-full bg-primary" />
              <div className="w-1.5 h-10 rounded-full bg-primary" />
              <div className="w-1.5 h-6 rounded-full bg-primary" />
              <span className="ml-2 text-xl font-bold text-foreground tracking-tight">Velocitä</span>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">
                {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {isLogin ? 'Faça login para acessar o sistema' : 'Preencha os dados para começar'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Nome completo</Label>
                  <Input id="name" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Seu nome" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="••••••" />
              </div>
              <Button type="submit" className="w-full h-11 font-semibold" disabled={submitting}>
                {submitting ? 'Aguarde...' : isLogin ? 'Entrar' : 'Cadastrar'}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isLogin ? 'Não tem conta?' : 'Já tem conta?'}{' '}
              <button onClick={() => setIsLogin(!isLogin)} className="text-primary font-medium hover:underline">
                {isLogin ? 'Cadastre-se' : 'Faça login'}
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
