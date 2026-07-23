import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ImportContext {
  departmentId: string;
  referenceMonth: string; // YYYY-MM
  obligationId: string;
  allowedDocTypeIds: string[];
}

interface Department { id: string; name: string }
interface Obligation { id: string; name: string; department_id: string; competence_rule: string; recurrence: string }
interface DocType { id: string; name: string }
interface Activity { obligation_id: string; document_type_id: string | null }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (ctx: ImportContext) => void;
}

function currentMonthIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ImportSetupDialog({ open, onOpenChange, onConfirm }: Props) {
  const { isAdmin, user } = useAuth();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [userDeptId, setUserDeptId] = useState<string | null>(null);

  const [departmentId, setDepartmentId] = useState('');
  const [referenceMonth, setReferenceMonth] = useState(currentMonthIso());
  const [obligationId, setObligationId] = useState('');
  const [allowedDocTypeIds, setAllowedDocTypeIds] = useState<string[]>([]);
  const [oblPopoverOpen, setOblPopoverOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [dRes, oRes, aRes, tRes, pRes] = await Promise.all([
        supabase.from('departments').select('id, name').order('name'),
        supabase.from('obligations').select('id, name, department_id, competence_rule, recurrence').order('name'),
        supabase.from('obligation_activities').select('obligation_id, document_type_id').eq('type', 'document'),
        supabase.from('document_types').select('id, name').order('name'),
        user?.id ? supabase.from('profiles').select('department_id').eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (dRes.data) setDepartments(dRes.data);
      if (oRes.data) setObligations(oRes.data as Obligation[]);
      if (aRes.data) setActivities(aRes.data as Activity[]);
      if (tRes.data) setDocTypes(tRes.data);
      const dept = (pRes as any)?.data?.department_id ?? null;
      setUserDeptId(dept);
      if (!isAdmin && dept) setDepartmentId(dept);
    })();
  }, [open, user?.id, isAdmin]);

  // Reset downstream selections when upstream changes
  useEffect(() => { setObligationId(''); setAllowedDocTypeIds([]); }, [departmentId, referenceMonth]);
  useEffect(() => {
    if (!obligationId) { setAllowedDocTypeIds([]); return; }
    const ids = activities
      .filter(a => a.obligation_id === obligationId && a.document_type_id)
      .map(a => a.document_type_id as string);
    setAllowedDocTypeIds([...new Set(ids)]);
  }, [obligationId, activities]);

  const visibleDepartments = useMemo(
    () => (isAdmin || !userDeptId ? departments : departments.filter(d => d.id === userDeptId)),
    [departments, isAdmin, userDeptId],
  );

  const filteredObligations = useMemo(
    () => obligations.filter(o => o.department_id === departmentId),
    [obligations, departmentId],
  );

  const obligationDocTypes = useMemo(() => {
    const set = new Set(
      activities.filter(a => a.obligation_id === obligationId && a.document_type_id).map(a => a.document_type_id as string),
    );
    return docTypes.filter(t => set.has(t.id));
  }, [activities, obligationId, docTypes]);

  const selectedObligation = filteredObligations.find(o => o.id === obligationId);
  const isQuarterly = selectedObligation?.recurrence === 'quarterly';

  // Derive quarter/year from current referenceMonth (YYYY-MM)
  const [refYear, refMonth] = referenceMonth.split('-').map(Number);
  const currentQuarter = refMonth ? String(Math.ceil(refMonth / 3)).padStart(2, '0') : '01';
  const currentYear = refYear || new Date().getFullYear();
  const quarterEndMonth: Record<string, string> = { '01': '03', '02': '06', '03': '09', '04': '12' };
  const yearOptions = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  function setQuarter(q: string, y: number) {
    setReferenceMonth(`${y}-${quarterEndMonth[q]}`);
  }

  // When switching to a quarterly obligation, snap referenceMonth to the end of the corresponding quarter
  useEffect(() => {
    if (!isQuarterly || !referenceMonth) return;
    const endMonth = quarterEndMonth[currentQuarter];
    if (refMonth && String(refMonth).padStart(2, '0') !== endMonth) {
      setReferenceMonth(`${currentYear}-${endMonth}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isQuarterly]);

  function toggleType(id: string) {
    setAllowedDocTypeIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const canConfirm = !!departmentId && !!referenceMonth && !!obligationId && allowedDocTypeIds.length > 0;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm({ departmentId, referenceMonth, obligationId, allowedDocTypeIds });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Importar Documentos</DialogTitle>
          <DialogDescription>
            Defina o contexto antes de enviar. A IA só precisará identificar a empresa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>1. Departamento</Label>
            <Select value={departmentId} onValueChange={setDepartmentId} disabled={!isAdmin && !!userDeptId}>
              <SelectTrigger><SelectValue placeholder="Selecione o departamento" /></SelectTrigger>
              <SelectContent>
                {visibleDepartments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>2. Competência</Label>
            {isQuarterly ? (
              <div className="grid grid-cols-2 gap-2">
                <Select value={currentQuarter} onValueChange={(q) => setQuarter(q, currentYear)}>
                  <SelectTrigger><SelectValue placeholder="Trimestre" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="01">01 — Jan–Mar</SelectItem>
                    <SelectItem value="02">02 — Abr–Jun</SelectItem>
                    <SelectItem value="03">03 — Jul–Set</SelectItem>
                    <SelectItem value="04">04 — Out–Dez</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={String(currentYear)} onValueChange={(y) => setQuarter(currentQuarter, Number(y))}>
                  <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                  <SelectContent>
                    {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="col-span-2 text-xs text-muted-foreground">
                  Competência trimestral selecionada: <strong>{currentQuarter}/{currentYear}</strong>
                </p>
              </div>
            ) : (
              <Input type="month" value={referenceMonth} onChange={e => setReferenceMonth(e.target.value)} disabled={!departmentId} />
            )}
          </div>

          <div className="space-y-2">
            <Label>3. Obrigação</Label>
            <Popover open={oblPopoverOpen} onOpenChange={setOblPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  disabled={!departmentId || !referenceMonth}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">{selectedObligation?.name || 'Selecione a obrigação'}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar obrigação..." />
                  <CommandList className="max-h-[260px]">
                    <CommandEmpty>Nenhuma obrigação para este departamento.</CommandEmpty>
                    <CommandGroup>
                      {filteredObligations.map(o => (
                        <CommandItem
                          key={o.id}
                          value={o.name}
                          onSelect={() => { setObligationId(o.id); setOblPopoverOpen(false); }}
                        >
                          <Check className={cn('mr-2 h-4 w-4', obligationId === o.id ? 'opacity-100' : 'opacity-0')} />
                          <span className="text-sm">{o.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>4. Tipo(s) de documento</Label>
              {obligationDocTypes.length > 1 && (
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setAllowedDocTypeIds(obligationDocTypes.map(t => t.id))}
                  >Todos</button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setAllowedDocTypeIds([])}
                  >Limpar</button>
                </div>
              )}
            </div>
            {!obligationId ? (
              <p className="text-xs text-muted-foreground">Selecione uma obrigação para ver os tipos.</p>
            ) : obligationDocTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Esta obrigação não possui atividades de documento cadastradas.</p>
            ) : (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {obligationDocTypes.map(t => (
                  <label key={t.id} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent">
                    <Checkbox
                      checked={allowedDocTypeIds.includes(t.id)}
                      onCheckedChange={() => toggleType(t.id)}
                      disabled={obligationDocTypes.length === 1}
                    />
                    <span className="text-sm">{t.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>Continuar para upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}