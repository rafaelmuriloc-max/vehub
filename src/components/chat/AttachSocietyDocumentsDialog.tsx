import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Company { id: string; company_name: string }
interface DocItem { id: string; label: string; fileName: string; path: string }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationClientId?: string | null;
  whatsappPhone?: string | null;
  onSend: (mediaUrl: string, fileName: string, type: 'image' | 'video' | 'document' | 'audio') => Promise<void> | void;
}

function detectType(fileName: string): 'image' | 'video' | 'document' | 'audio' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'm4a', 'ogg', 'oga', 'wav', 'aac'].includes(ext)) return 'audio';
  return 'document';
}

export function AttachSocietyDocumentsDialog({ open, onOpenChange, conversationClientId, whatsappPhone, onSend }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [companyOpen, setCompanyOpen] = useState(false);

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setCompanyId('');
      setSelectedIds(new Set());
      setDocs([]);
    }
  }, [open]);

  // Load companies (same logic as AttachFromObligationDialog)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingCompanies(true);
      try {
        const idsSet = new Set<string>();
        if (conversationClientId) idsSet.add(conversationClientId);
        if (whatsappPhone) {
          const digits = whatsappPhone.replace(/\D/g, '');
          const searchPhone = digits.length > 4 ? digits.slice(-8) : digits;
          const { data: contacts } = await supabase
            .from('client_department_contacts')
            .select('client_id, contact_phone');
          (contacts || [])
            .filter(c => c.contact_phone && c.contact_phone.replace(/\D/g, '').includes(searchPhone))
            .forEach(c => idsSet.add(c.client_id));
        }
        const clientIds = [...idsSet];
        if (clientIds.length === 0) {
          if (!cancelled) setCompanies([]);
          return;
        }
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, company_name')
          .in('id', clientIds)
          .order('company_name');
        if (!cancelled) {
          setCompanies(clientsData || []);
          if ((clientsData || []).length === 1) setCompanyId(clientsData![0].id);
        }
      } finally {
        if (!cancelled) setLoadingCompanies(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, conversationClientId, whatsappPhone]);

  // Load society docs
  useEffect(() => {
    if (!companyId) { setDocs([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingDocs(true);
      setSelectedIds(new Set());
      try {
        const { data } = await supabase
          .from('client_society_documents' as any)
          .select('id, document_label, file_name, file_url')
          .eq('client_id', companyId)
          .order('document_label');
        const list: DocItem[] = ((data as any[]) || []).map(d => ({
          id: d.id,
          label: d.document_label,
          fileName: d.file_name || (d.file_url?.split('/').pop() || 'arquivo'),
          path: d.file_url,
        }));
        if (!cancelled) setDocs(list);
      } finally {
        if (!cancelled) setLoadingDocs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  const selectedCompany = useMemo(() => companies.find(c => c.id === companyId), [companies, companyId]);
  const allSelected = docs.length > 0 && selectedIds.size === docs.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(docs.map(d => d.id)));
  };

  const sendDocs = async (toSend: DocItem[]) => {
    if (toSend.length === 0) return;
    setSending(true);
    setSendProgress({ current: 0, total: toSend.length });
    let success = 0, failed = 0;
    for (let i = 0; i < toSend.length; i++) {
      const d = toSend[i];
      setSendProgress({ current: i + 1, total: toSend.length });
      try {
        const { data: signed, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(d.path, 60 * 60 * 24 * 7);
        if (error || !signed?.signedUrl) throw error || new Error('Falha ao gerar link');
        await onSend(signed.signedUrl, d.fileName, detectType(d.fileName));
        success++;
      } catch (e) {
        failed++;
        console.error('Falha ao enviar documento societário:', d.fileName, e);
      }
    }
    setSending(false);
    setSendProgress(null);
    if (failed === 0) toast({ title: `${success} arquivo(s) enviado(s)` });
    else toast({ title: 'Envio concluído com falhas', description: `${success} enviado(s), ${failed} com erro.`, variant: 'destructive' });
    onOpenChange(false);
  };

  const handleSendSelected = () => sendDocs(docs.filter(d => selectedIds.has(d.id)));
  const handleSendAll = () => sendDocs(docs);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] overflow-hidden flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Anexar documentos da empresa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-y-auto min-w-0 -mx-1 px-1">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Empresa</label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal min-w-0" disabled={loadingCompanies || companies.length === 0}>
                  <span className="truncate text-left flex-1 min-w-0">
                    {loadingCompanies ? 'Carregando...' : (selectedCompany?.company_name || (companies.length === 0 ? 'Nenhuma empresa vinculada' : 'Selecione a empresa'))}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar empresa..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma empresa.</CommandEmpty>
                    <CommandGroup>
                      {companies.map(c => (
                        <CommandItem key={c.id} value={c.company_name} onSelect={() => { setCompanyId(c.id); setCompanyOpen(false); }}>
                          <Check className={cn('mr-2 h-4 w-4', companyId === c.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="truncate">{c.company_name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Documentos</label>
              {docs.length > 0 && (
                <span className="text-xs text-muted-foreground">{selectedIds.size} de {docs.length} selecionado(s)</span>
              )}
            </div>
            {!companyId ? (
              <p className="text-sm text-muted-foreground py-2">Selecione uma empresa primeiro.</p>
            ) : loadingDocs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando documentos...
              </div>
            ) : docs.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum documento societário cadastrado.</p>
            ) : (
              <div className="border rounded-md overflow-hidden min-w-0">
                {docs.length > 1 && (
                  <label className="flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-accent/50 text-sm">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                    />
                    <span className="font-medium">Selecionar todos</span>
                  </label>
                )}
                <div className="max-h-72 overflow-y-auto p-1 min-w-0">
                  {docs.map(d => {
                    const checked = selectedIds.has(d.id);
                    return (
                      <label
                        key={d.id}
                        title={d.fileName}
                        className={cn(
                          'flex items-center gap-2 px-2 py-2 rounded text-left text-sm hover:bg-accent transition-colors cursor-pointer min-w-0 w-full',
                          checked && 'bg-accent'
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleId(d.id)} />
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{d.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{d.fileName}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col-reverse sm:flex-row sm:flex-wrap sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          {docs.length > 1 && (
            <Button variant="secondary" onClick={handleSendAll} disabled={sending || docs.length === 0}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar todos ({docs.length})
            </Button>
          )}
          <Button onClick={handleSendSelected} disabled={selectedIds.size === 0 || sending}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {sending && sendProgress ? `Enviando ${sendProgress.current}/${sendProgress.total}` : `Enviar selecionados (${selectedIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}