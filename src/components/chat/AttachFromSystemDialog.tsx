import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FolderOpen, Building2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickObligation: () => void;
  onPickSociety: () => void;
}

export function AttachFromSystemDialog({ open, onOpenChange, onPickObligation, onPickSociety }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-md p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Anexar do sistema</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 pt-2">
          <button
            onClick={() => { onOpenChange(false); onPickObligation(); }}
            className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <FolderOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">Anexar de obrigação</p>
              <p className="text-xs text-muted-foreground">Documentos vinculados a obrigações da empresa.</p>
            </div>
          </button>
          <button
            onClick={() => { onOpenChange(false); onPickSociety(); }}
            className="flex items-center gap-3 p-4 rounded-lg border bg-card hover:bg-accent transition-colors text-left"
          >
            <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium">Anexar documentos da empresa</p>
              <p className="text-xs text-muted-foreground">Documentos cadastrados na aba Societário.</p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}