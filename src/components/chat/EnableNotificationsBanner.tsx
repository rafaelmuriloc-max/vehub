import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebPush } from '@/hooks/useWebPush';
import { useState } from 'react';

export function EnableNotificationsBanner() {
  const { supported, permission, subscribe, subscribing, isStandalone } = useWebPush();
  const [dismissed, setDismissed] = useState(
    typeof window !== 'undefined' && sessionStorage.getItem('push-banner-dismissed') === '1'
  );

  if (!supported || permission === 'granted' || permission === 'denied' || dismissed) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const needsInstall = isIOS && !isStandalone;

  return (
    <div className="flex items-center gap-2 bg-primary/10 border-b border-primary/20 px-3 py-2 text-sm">
      <Bell className="w-4 h-4 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        {needsInstall ? (
          <span className="text-foreground">
            Para receber notificações, abra no Safari e use{' '}
            <strong>Compartilhar → Adicionar à Tela de Início</strong>.
          </span>
        ) : (
          <span className="text-foreground">Ative as notificações para receber novas mensagens.</span>
        )}
      </div>
      {!needsInstall && (
        <Button size="sm" onClick={subscribe} disabled={subscribing}>
          Ativar
        </Button>
      )}
      <button
        onClick={() => {
          sessionStorage.setItem('push-banner-dismissed', '1');
          setDismissed(true);
        }}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Fechar"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}