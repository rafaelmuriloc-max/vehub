import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useChatNotification } from '@/hooks/useChatNotification';
import Chat from './Chat';

export default function ChatPopup() {
  const { user, loading } = useAuth();
  useChatNotification();

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-background">
      <Chat />
    </div>
  );
}