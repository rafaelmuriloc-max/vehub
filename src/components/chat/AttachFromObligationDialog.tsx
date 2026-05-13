import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, Loader2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface Company { id: string; company_name: string }
interface ObligationItem {
  instanceId: string;
  obligationName: string;
  referenceMonth: string;
}
interface FileItem {
  path: string;
  fileName: string;
  source: 'document' | 'completion';
}

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

export function AttachFromObligationDialog({ open, onOpenChange, conversationClientId, whatsappPhone, onSend }: Props) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [companyId, setCompanyId] = useState<string>('');
  const [companyOpen, setCompanyOpen] = useState(false);

  const [obligations, setObligations] = useState<ObligationItem[]>([]);
  const [loadingObligations, setLoadingObligations] = useState(false);
  const [instanceId, setInstanceId] = useState<string>('');
  const [obligationOpen, setObligationOpen] = useState(false);

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ current: number; total: number } | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCompanyId('');
      setInstanceId('');
      setSelectedPaths(new Set());
      setObligations([]);
      setFiles([]);
    }
  }, [open]);

  // Load companies for the conversation
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingCompanies(true);
      try {
        let clientIds: string[] = [];
        if (conversationClientId) {
          clientIds = [conversationClientId];
        } else if (whatsappPhone) {
          const digits = whatsappPhone.replace(/\D/g, '');
          const searchPhone = digits.length > 4 ? digits.slice(-8) : digits;
          const { data: contacts } = await supabase
            .from('client_department_contacts')
            .select('client_id, contact_phone');
          clientIds = [...new Set((contacts || [])
            .filter(c => c.contact_phone && c.contact_phone.includes(searchPhone))
            .map(c => c.client_id))];
        }
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
          if ((clientsData || []).length === 1) {
            setCompanyId(clientsData![0].id);
          }
        }
      } finally {
        if (!cancelled) setLoadingCompanies(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, conversationClientId, whatsappPhone]);

  // Load obligations with files for selected company
  useEffect(() => {
    if (!companyId) { setObligations([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingObligations(true);
      setInstanceId('');
      setFiles([]);
      setSelectedPaths(new Set());
      try {
        // 1) Get all instances for the client
        const { data: instances } = await supabase
          .from('obligation_instances')
          .select('id, obligation_id, reference_month')
          .eq('client_id', companyId)
          .order('reference_month', { ascending: false });
        if (!instances || instances.length === 0) {
          if (!cancelled) setObligations([]);
          return;
        }
        const instIds = instances.map(i => i.id);
        const obIds = [...new Set(instances.map(i => i.obligation_id))];

        const [docsRes, compsRes, obsRes] = await Promise.all([
          supabase.from('documents')
            .select('linked_obligation_id')
            .eq('client_id', companyId)
            .not('linked_obligation_id', 'is', null),
          supabase.from('obligation_activity_completions')
            .select('instance_id, file_url, obligation_activities!inner(obligation_id)')
            .in('instance_id', instIds)
            .not('file_url', 'is', null),
          supabase.from('obligations')
            .select('id, name')
            .in('id', obIds),
        ]);

        const obNames = new Map((obsRes.data || []).map(o => [o.id, o.name]));
        const instWithFiles = new Set<string>();
        (docsRes.data || []).forEach(d => { if (d.linked_obligation_id) instWithFiles.add(d.linked_obligation_id); });
        (compsRes.data || []).forEach(c => { if (c.instance_id) instWithFiles.add(c.instance_id); });

        const items: ObligationItem[] = instances
          .filter(i => instWithFiles.has(i.id))
          .map(i => ({
            instanceId: i.id,
            obligationName: obNames.get(i.obligation_id) || 'Obrigação',
            referenceMonth: i.reference_month,
          }));
        if (!cancelled) setObligations(items);
      } finally {
        if (!cancelled) setLoadingObligations(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId]);

  // Load files for selected obligation instance
  useEffect(() => {
    if (!instanceId || !companyId) { setFiles([]); return; }
    let cancelled = false;
    (async () => {
      setLoadingFiles(true);
      setSelectedPaths(new Set());
      try {
        const [docsRes, compsRes] = await Promise.all([
          supabase.from('documents')
            .select('file_url, file_name')
            .eq('client_id', companyId)
            .eq('linked_obligation_id', instanceId),
          supabase.from('obligation_activity_completions')
            .select('file_url')
            .eq('instance_id', instanceId)
            .not('file_url', 'is', null),
        ]);
        const list: FileItem[] = [];
        (docsRes.data || []).forEach(d => {
          if (d.file_url) list.push({
            path: d.file_url,
            fileName: d.file_name || (d.file_url.split('/').pop() || 'arquivo'),
            source: 'document',
          });
        });
        (compsRes.data || []).forEach(c => {
          if (c.file_url) list.push({
            path: c.file_url,
            fileName: c.file_url.split('/').pop() || 'arquivo',
            source: 'completion',
          });
        });
        // dedupe by path
        const seen = new Set<string>();
        const dedup = list.filter(f => (seen.has(f.path) ? false : (seen.add(f.path), true)));
        if (!cancelled) setFiles(dedup);
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId, companyId]);

  const selectedObligation = useMemo(() => obligations.find(o => o.instanceId === instanceId), [obligations, instanceId]);
  const selectedCompany = useMemo(() => companies.find(c => c.id === companyId), [companies, companyId]);

  const allSelected = files.length > 0 && selectedPaths.size === files.length;
  const someSelected = selectedPaths.size > 0 && !allSelected;

  const togglePath = (path: string) => {
    setSelectedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) setSelectedPaths(new Set());
    else setSelectedPaths(new Set(files.map(f => f.path)));
  };

  const sendFiles = async (toSend: FileItem[]) => {
    if (toSend.length === 0) return;
    setSending(true);
    setSendProgress({ current: 0, total: toSend.length });
    let success = 0;
    let failed = 0;
    for (let i = 0; i < toSend.length; i++) {
      const f = toSend[i];
      setSendProgress({ current: i + 1, total: toSend.length });
      try {
        const { data: signed, error } = await supabase.storage
          .from('documents')
          .createSignedUrl(f.path, 60 * 60 * 24 * 7);
        if (error || !signed?.signedUrl) throw error || new Error('Falha ao gerar link');
        await onSend(signed.signedUrl, f.fileName, detectType(f.fileName));
        success++;
      } catch (e) {
        failed++;
        console.error('Falha ao enviar arquivo da obrigação:', f.fileName, e);
      }
    }
    setSending(false);
    setSendProgress(null);
    if (failed === 0) {
      toast({ title: `${success} arquivo(s) enviado(s)` });
    } else {
      toast({
        title: 'Envio concluído com falhas',
        description: `${success} enviado(s), ${failed} com erro.`,
        variant: 'destructive',
      });
    }
    onOpenChange(false);
  };

  const handleSendSelected = () => sendFiles(files.filter(f => selectedPaths.has(f.path)));
  const handleSendAll = () => sendFiles(files);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar arquivo de obrigação</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Empresa */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Empresa</label>
            <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={loadingCompanies || companies.length === 0}>
                  <span className="truncate text-left">
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

          {/* Obrigação */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Obrigação</label>
            <Popover open={obligationOpen} onOpenChange={setObligationOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal" disabled={!companyId || loadingObligations || obligations.length === 0}>
                  <span className="truncate text-left">
                    {loadingObligations
                      ? 'Carregando...'
                      : !companyId
                        ? 'Selecione uma empresa primeiro'
                        : obligations.length === 0
                          ? 'Nenhuma obrigação com arquivos'
                          : selectedObligation
                            ? `${selectedObligation.obligationName} — ${format(new Date(selectedObligation.referenceMonth + 'T00:00:00'), 'MM/yyyy')}`
                            : 'Selecione a obrigação'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar obrigação..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma obrigação.</CommandEmpty>
                    <CommandGroup>
                      {obligations.map(o => {
                        const label = `${o.obligationName} — ${format(new Date(o.referenceMonth + 'T00:00:00'), 'MM/yyyy')}`;
                        return (
                          <CommandItem key={o.instanceId} value={label} onSelect={() => { setInstanceId(o.instanceId); setObligationOpen(false); }}>
                            <Check className={cn('mr-2 h-4 w-4', instanceId === o.instanceId ? 'opacity-100' : 'opacity-0')} />
                            <span className="truncate">{label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Arquivo */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Arquivos</label>
              {files.length > 0 && (
                <span className="text-xs text-muted-foreground">{selectedPaths.size} de {files.length} selecionado(s)</span>
              )}
            </div>
            {!instanceId ? (
              <p className="text-sm text-muted-foreground py-2">Selecione uma obrigação primeiro.</p>
            ) : loadingFiles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando arquivos...
              </div>
            ) : files.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Nenhum arquivo encontrado.</p>
            ) : (
              <div className="border rounded-md">
                {files.length > 1 && (
                  <label className="flex items-center gap-2 px-3 py-2 border-b cursor-pointer hover:bg-accent/50 text-sm">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleAll}
                    />
                    <span className="font-medium">Selecionar todos</span>
                  </label>
                )}
                <div className="max-h-48 overflow-y-auto p-1">
                  {files.map(f => {
                    const checked = selectedPaths.has(f.path);
                    return (
                      <label
                        key={f.path}
                        className={cn(
                          'flex items-center gap-2 px-2 py-2 rounded text-left text-sm hover:bg-accent transition-colors cursor-pointer',
                          checked && 'bg-accent'
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => togglePath(f.path)} />
                        <FileText className="h-4 w-4 shrink-0 text-primary" />
                        <span className="truncate flex-1">{f.fileName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancelar</Button>
          {files.length > 1 && (
            <Button variant="secondary" onClick={handleSendAll} disabled={sending || files.length === 0}>
              {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar todos ({files.length})
            </Button>
          )}
          <Button onClick={handleSendSelected} disabled={selectedPaths.size === 0 || sending}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {sending && sendProgress
              ? `Enviando ${sendProgress.current}/${sendProgress.total}...`
              : `Enviar selecionados${selectedPaths.size > 0 ? ` (${selectedPaths.size})` : ''}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}