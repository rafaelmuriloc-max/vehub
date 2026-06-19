import { useState, useEffect } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Trash2, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  cnpjContribuinte: string;
  onSubmit: (dadosJson: string) => void;
  loading?: boolean;
  disabled?: boolean;
}

const TRIBUTO_OPTIONS = [
  { value: '1001', label: '1001 - IRPJ' },
  { value: '1002', label: '1002 - IPI' },
  { value: '1004', label: '1004 - CSLL' },
  { value: '1005', label: '1005 - COFINS' },
  { value: '1006', label: '1006 - PIS/Pasep' },
  { value: '1007', label: '1007 - ISS' },
  { value: '1010', label: '1010 - CPP' },
];

interface Isencao { codTributo: number; valor: number; identificador: number; }
interface Reducao { codTributo: number; valor: number; percentualReducao: number; identificador: number; }
interface ReceitaAtividade {
  valor: number;
  codigoOutroMunicipio: string;
  outraUf: string;
  isencoes: Isencao[];
  reducoes: Reducao[];
}
interface Atividade {
  idAtividade: number;
  valorAtividade: number;
  receitasAtividade: ReceitaAtividade[];
}
interface Estabelecimento {
  cnpjCompleto: string;
  atividades: Atividade[];
}
interface ValorComparacao { codigoTributo: number; valor: number; }

function calcPrevMonths(pa: string): number[] {
  if (pa.length !== 6) return [];
  const year = parseInt(pa.substring(0, 4));
  const month = parseInt(pa.substring(4, 6));
  const months: number[] = [];
  let y = year, m = month;
  for (let i = 0; i < 12; i++) {
    m--;
    if (m < 1) { m = 12; y--; }
    months.push(y * 100 + m);
  }
  return months;
}

function emptyReceita(): ReceitaAtividade {
  return { valor: 0, codigoOutroMunicipio: '', outraUf: '', isencoes: [], reducoes: [] };
}

export default function PgdasdDeclaracaoForm({ cnpjContribuinte, onSubmit, loading, disabled }: Props) {
  const [pa, setPa] = useState('');
  const [tipoDeclaracao, setTipoDeclaracao] = useState('1');
  const [transmissao, setTransmissao] = useState(true);
  const [comparacao, setComparacao] = useState(true);
  const [semMovimento, setSemMovimento] = useState(false);

  // Receitas do período
  const [recCompInterno, setRecCompInterno] = useState(0);
  const [recCompExterno, setRecCompExterno] = useState(0);
  const [recCaixaInterno, setRecCaixaInterno] = useState<number | null>(null);
  const [recCaixaExterno, setRecCaixaExterno] = useState<number | null>(null);
  const [valorFixoIcms, setValorFixoIcms] = useState<number | null>(null);
  const [valorFixoIss, setValorFixoIss] = useState<number | null>(null);

  // Receitas anteriores e folhas
  const [receitasAnteriores, setReceitasAnteriores] = useState<{ pa: number; valorInterno: number; valorExterno: number }[]>([]);
  const [folhasSalario, setFolhasSalario] = useState<{ pa: number; valor: number }[]>([]);

  // Estabelecimentos
  const [estabelecimentos, setEstabelecimentos] = useState<Estabelecimento[]>([
    { cnpjCompleto: cnpjContribuinte, atividades: [{ idAtividade: 1, valorAtividade: 0, receitasAtividade: [emptyReceita()] }] },
  ]);

  // Comparação
  const [valoresComparacao, setValoresComparacao] = useState<ValorComparacao[]>([]);

  useEffect(() => {
    const months = calcPrevMonths(pa);
    if (months.length === 12) {
      setReceitasAnteriores(months.map(m => ({ pa: m, valorInterno: 0, valorExterno: 0 })));
      setFolhasSalario(months.map(m => ({ pa: m, valor: 0 })));
    }
  }, [pa]);

  useEffect(() => {
    setEstabelecimentos(prev => prev.map((e, i) => i === 0 ? { ...e, cnpjCompleto: cnpjContribuinte } : e));
  }, [cnpjContribuinte]);

  function handleSubmit() {
    // Validação: declaração sem movimento vs com movimento
    if (!semMovimento) {
      const totalReceita = (recCompInterno || 0) + (recCompExterno || 0);
      if (totalReceita <= 0) {
        toast.error('Receita do período é zero. Marque "Declaração sem movimento" ou informe os valores.');
        return;
      }
      const atividadeZerada = estabelecimentos.some(est =>
        est.atividades.some(atv => (atv.valorAtividade || 0) <= 0)
      );
      if (atividadeZerada) {
        toast.error('Toda atividade deve ter valor maior que zero. Remova-as ou marque "Declaração sem movimento".');
        return;
      }
    }

    const payload = {
      cnpjCompleto: cnpjContribuinte,
      pa: Number(pa),
      indicadorTransmissao: transmissao,
      indicadorComparacao: semMovimento ? false : comparacao,
      declaracao: semMovimento ? {
        tipoDeclaracao: Number(tipoDeclaracao),
        receitaPaCompetenciaInterno: 0,
        receitaPaCompetenciaExterno: 0,
        receitaPaCaixaInterno: null,
        receitaPaCaixaExterno: null,
        valorFixoIcms: null,
        valorFixoIss: null,
        receitasBrutasAnteriores: receitasAnteriores,
        folhasSalario: folhasSalario,
        naoOptante: null,
        estabelecimentos: [{ cnpjCompleto: cnpjContribuinte }],
      } : {
        tipoDeclaracao: Number(tipoDeclaracao),
        receitaPaCompetenciaInterno: recCompInterno,
        receitaPaCompetenciaExterno: recCompExterno,
        receitaPaCaixaInterno: recCaixaInterno,
        receitaPaCaixaExterno: recCaixaExterno,
        valorFixoIcms: valorFixoIcms,
        valorFixoIss: valorFixoIss,
        receitasBrutasAnteriores: receitasAnteriores,
        folhasSalario: folhasSalario,
        naoOptante: null,
        estabelecimentos: estabelecimentos.map(est => ({
          cnpjCompleto: est.cnpjCompleto,
          atividades: est.atividades.map(atv => ({
            idAtividade: atv.idAtividade,
            valorAtividade: atv.valorAtividade,
            receitasAtividade: atv.receitasAtividade.map(r => ({
              valor: r.valor,
              codigoOutroMunicipio: r.codigoOutroMunicipio ? Number(r.codigoOutroMunicipio) : null,
              outraUf: r.outraUf || null,
              isencoes: r.isencoes.length > 0 ? r.isencoes : null,
              reducoes: r.reducoes.length > 0 ? r.reducoes : null,
              qualificacoesTributarias: null,
              exigibilidadesSuspensas: null,
            })),
          })),
        })),
      },
      valoresParaComparacao: (!semMovimento && comparacao) ? valoresComparacao : [],
    };
    onSubmit(JSON.stringify(payload));
  }

  const numField = (value: number | null, onChange: (v: number | null) => void, placeholder = '0.00') => (
    <Input
      type="number"
      step="0.01"
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
      placeholder={placeholder}
    />
  );

  const numFieldRequired = (value: number, onChange: (v: number) => void, placeholder = '0.00') => (
    <Input
      type="number"
      step="0.01"
      value={value}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      placeholder={placeholder}
    />
  );

  // Estabelecimento helpers
  function updateEstabelecimento(idx: number, update: Partial<Estabelecimento>) {
    setEstabelecimentos(prev => prev.map((e, i) => i === idx ? { ...e, ...update } : e));
  }
  function addAtividade(estIdx: number) {
    setEstabelecimentos(prev => prev.map((e, i) => i === estIdx ? { ...e, atividades: [...e.atividades, { idAtividade: 1, valorAtividade: 0, receitasAtividade: [emptyReceita()] }] } : e));
  }
  function updateAtividade(estIdx: number, atvIdx: number, update: Partial<Atividade>) {
    setEstabelecimentos(prev => prev.map((e, ei) => ei === estIdx ? {
      ...e, atividades: e.atividades.map((a, ai) => ai === atvIdx ? { ...a, ...update } : a)
    } : e));
  }
  function removeAtividade(estIdx: number, atvIdx: number) {
    setEstabelecimentos(prev => prev.map((e, ei) => ei === estIdx ? { ...e, atividades: e.atividades.filter((_, ai) => ai !== atvIdx) } : e));
  }
  function updateReceita(estIdx: number, atvIdx: number, recIdx: number, update: Partial<ReceitaAtividade>) {
    setEstabelecimentos(prev => prev.map((e, ei) => ei === estIdx ? {
      ...e, atividades: e.atividades.map((a, ai) => ai === atvIdx ? {
        ...a, receitasAtividade: a.receitasAtividade.map((r, ri) => ri === recIdx ? { ...r, ...update } : r)
      } : a)
    } : e));
  }

  return (
    <div className="space-y-3">
      <Accordion type="multiple" defaultValue={['geral', 'receitas']} className="w-full">
        {/* Seção 1 — Dados Gerais */}
        <AccordionItem value="geral">
          <AccordionTrigger className="text-sm font-semibold">1. Dados Gerais</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div>
              <Label>Período de Apuração (AAAAMM) <span className="text-destructive">*</span></Label>
              <Input value={pa} onChange={e => setPa(e.target.value)} placeholder="202401" />
            </div>
            <div>
              <Label>Tipo de Declaração</Label>
              <Select value={tipoDeclaracao} onValueChange={setTipoDeclaracao}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Original</SelectItem>
                  <SelectItem value="2">2 - Retificadora</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox checked={transmissao} onCheckedChange={(v) => setTransmissao(!!v)} id="transmissao" />
                <Label htmlFor="transmissao">Indicador de Transmissão</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={comparacao} onCheckedChange={(v) => setComparacao(!!v)} id="comparacao" />
                <Label htmlFor="comparacao">Indicador de Comparação</Label>
              </div>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t">
              <Checkbox checked={semMovimento} onCheckedChange={(v) => setSemMovimento(!!v)} id="semMovimento" />
              <Label htmlFor="semMovimento" className="font-semibold">
                Declaração sem movimento (sem atividades/receitas no período)
              </Label>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Seção 2 — Receitas do Período */}
        <AccordionItem value="receitas">
          <AccordionTrigger className="text-sm font-semibold">2. Receitas do Período</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Receita Competência Interno</Label>
                {numFieldRequired(recCompInterno, setRecCompInterno)}
              </div>
              <div>
                <Label>Receita Competência Externo</Label>
                {numFieldRequired(recCompExterno, setRecCompExterno)}
              </div>
              <div>
                <Label>Receita Caixa Interno (opcional)</Label>
                {numField(recCaixaInterno, setRecCaixaInterno)}
              </div>
              <div>
                <Label>Receita Caixa Externo (opcional)</Label>
                {numField(recCaixaExterno, setRecCaixaExterno)}
              </div>
              <div>
                <Label>Valor Fixo ICMS (opcional)</Label>
                {numField(valorFixoIcms, setValorFixoIcms)}
              </div>
              <div>
                <Label>Valor Fixo ISS (opcional)</Label>
                {numField(valorFixoIss, setValorFixoIss)}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Seção 3 — Receitas Anteriores e Folhas */}
        <AccordionItem value="anteriores">
          <AccordionTrigger className="text-sm font-semibold">3. Receitas Anteriores e Folhas de Salário</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {receitasAnteriores.length === 0 ? (
              <p className="text-sm text-muted-foreground">Preencha o Período de Apuração para gerar os 12 meses anteriores.</p>
            ) : (
              <>
                <div>
                  <Label className="font-semibold">Receitas Brutas Anteriores</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Mês</TableHead>
                        <TableHead>Valor Interno</TableHead>
                        <TableHead>Valor Externo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receitasAnteriores.map((r, i) => (
                        <TableRow key={r.pa}>
                          <TableCell className="font-mono text-xs">{r.pa}</TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" className="h-8 text-xs" value={r.valorInterno}
                              onChange={e => setReceitasAnteriores(prev => prev.map((x, xi) => xi === i ? { ...x, valorInterno: parseFloat(e.target.value) || 0 } : x))} />
                          </TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" className="h-8 text-xs" value={r.valorExterno}
                              onChange={e => setReceitasAnteriores(prev => prev.map((x, xi) => xi === i ? { ...x, valorExterno: parseFloat(e.target.value) || 0 } : x))} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div>
                  <Label className="font-semibold">Folhas de Salário</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Mês</TableHead>
                        <TableHead>Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {folhasSalario.map((f, i) => (
                        <TableRow key={f.pa}>
                          <TableCell className="font-mono text-xs">{f.pa}</TableCell>
                          <TableCell>
                            <Input type="number" step="0.01" className="h-8 text-xs" value={f.valor}
                              onChange={e => setFolhasSalario(prev => prev.map((x, xi) => xi === i ? { ...x, valor: parseFloat(e.target.value) || 0 } : x))} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Seção 4 — Estabelecimentos */}
        <AccordionItem value="estabelecimentos">
          <AccordionTrigger className="text-sm font-semibold">4. Estabelecimentos e Atividades</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {estabelecimentos.map((est, estIdx) => (
              <Card key={estIdx} className="border">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label>CNPJ Completo</Label>
                      <Input value={est.cnpjCompleto} onChange={e => updateEstabelecimento(estIdx, { cnpjCompleto: e.target.value })} placeholder="00000000000100" />
                    </div>
                    {estIdx > 0 && (
                      <Button variant="ghost" size="icon" className="mt-5" onClick={() => setEstabelecimentos(prev => prev.filter((_, i) => i !== estIdx))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {est.atividades.map((atv, atvIdx) => (
                    <div key={atvIdx} className="border rounded-md p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center gap-2 justify-between">
                        <span className="text-xs font-semibold">Atividade {atvIdx + 1}</span>
                        {est.atividades.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeAtividade(estIdx, atvIdx)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">ID Atividade</Label>
                          <Input type="number" className="h-8 text-xs" value={atv.idAtividade}
                            onChange={e => updateAtividade(estIdx, atvIdx, { idAtividade: parseInt(e.target.value) || 1 })} />
                        </div>
                        <div>
                          <Label className="text-xs">Valor Atividade</Label>
                          <Input type="number" step="0.01" className="h-8 text-xs" value={atv.valorAtividade}
                            onChange={e => updateAtividade(estIdx, atvIdx, { valorAtividade: parseFloat(e.target.value) || 0 })} />
                        </div>
                      </div>

                      {atv.receitasAtividade.map((rec, recIdx) => (
                        <div key={recIdx} className="border rounded p-2 space-y-2 bg-background">
                          <span className="text-xs text-muted-foreground">Receita {recIdx + 1}</span>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">Valor</Label>
                              <Input type="number" step="0.01" className="h-7 text-xs" value={rec.valor}
                                onChange={e => updateReceita(estIdx, atvIdx, recIdx, { valor: parseFloat(e.target.value) || 0 })} />
                            </div>
                            <div>
                              <Label className="text-xs">Cód. Município</Label>
                              <Input className="h-7 text-xs" value={rec.codigoOutroMunicipio}
                                onChange={e => updateReceita(estIdx, atvIdx, recIdx, { codigoOutroMunicipio: e.target.value })} placeholder="9701" />
                            </div>
                            <div>
                              <Label className="text-xs">UF</Label>
                              <Input className="h-7 text-xs" value={rec.outraUf} maxLength={2}
                                onChange={e => updateReceita(estIdx, atvIdx, recIdx, { outraUf: e.target.value.toUpperCase() })} placeholder="DF" />
                            </div>
                          </div>

                          {/* Isenções */}
                          <div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Isenções</Label>
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                                const updated = [...rec.isencoes, { codTributo: 1007, valor: 0, identificador: rec.isencoes.length + 1 }];
                                updateReceita(estIdx, atvIdx, recIdx, { isencoes: updated });
                              }}><Plus className="h-3 w-3 mr-1" />Add</Button>
                            </div>
                            {rec.isencoes.map((ise, iseIdx) => (
                              <div key={iseIdx} className="flex gap-1 items-end mt-1">
                                <Input type="number" className="h-7 text-xs w-20" placeholder="Tributo" value={ise.codTributo}
                                  onChange={e => {
                                    const upd = [...rec.isencoes]; upd[iseIdx] = { ...upd[iseIdx], codTributo: parseInt(e.target.value) || 0 };
                                    updateReceita(estIdx, atvIdx, recIdx, { isencoes: upd });
                                  }} />
                                <Input type="number" step="0.01" className="h-7 text-xs flex-1" placeholder="Valor" value={ise.valor}
                                  onChange={e => {
                                    const upd = [...rec.isencoes]; upd[iseIdx] = { ...upd[iseIdx], valor: parseFloat(e.target.value) || 0 };
                                    updateReceita(estIdx, atvIdx, recIdx, { isencoes: upd });
                                  }} />
                                <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => {
                                  updateReceita(estIdx, atvIdx, recIdx, { isencoes: rec.isencoes.filter((_, i) => i !== iseIdx) });
                                }}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            ))}
                          </div>

                          {/* Reduções */}
                          <div>
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Reduções</Label>
                              <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => {
                                const updated = [...rec.reducoes, { codTributo: 1007, valor: 0, percentualReducao: 0, identificador: rec.reducoes.length + 1 }];
                                updateReceita(estIdx, atvIdx, recIdx, { reducoes: updated });
                              }}><Plus className="h-3 w-3 mr-1" />Add</Button>
                            </div>
                            {rec.reducoes.map((red, redIdx) => (
                              <div key={redIdx} className="flex gap-1 items-end mt-1">
                                <Input type="number" className="h-7 text-xs w-20" placeholder="Tributo" value={red.codTributo}
                                  onChange={e => {
                                    const upd = [...rec.reducoes]; upd[redIdx] = { ...upd[redIdx], codTributo: parseInt(e.target.value) || 0 };
                                    updateReceita(estIdx, atvIdx, recIdx, { reducoes: upd });
                                  }} />
                                <Input type="number" step="0.01" className="h-7 text-xs flex-1" placeholder="Valor" value={red.valor}
                                  onChange={e => {
                                    const upd = [...rec.reducoes]; upd[redIdx] = { ...upd[redIdx], valor: parseFloat(e.target.value) || 0 };
                                    updateReceita(estIdx, atvIdx, recIdx, { reducoes: upd });
                                  }} />
                                <Input type="number" step="0.01" className="h-7 text-xs w-20" placeholder="%" value={red.percentualReducao}
                                  onChange={e => {
                                    const upd = [...rec.reducoes]; upd[redIdx] = { ...upd[redIdx], percentualReducao: parseFloat(e.target.value) || 0 };
                                    updateReceita(estIdx, atvIdx, recIdx, { reducoes: upd });
                                  }} />
                                <Button variant="ghost" size="sm" className="h-7 px-1" onClick={() => {
                                  updateReceita(estIdx, atvIdx, recIdx, { reducoes: rec.reducoes.filter((_, i) => i !== redIdx) });
                                }}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                        updateAtividade(estIdx, atvIdx, { receitasAtividade: [...atv.receitasAtividade, emptyReceita()] });
                      }}><Plus className="h-3 w-3 mr-1" /> Receita</Button>
                    </div>
                  ))}

                  <Button variant="outline" size="sm" onClick={() => addAtividade(estIdx)}>
                    <Plus className="h-3 w-3 mr-1" /> Atividade
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Button variant="outline" size="sm" onClick={() => setEstabelecimentos(prev => [...prev, { cnpjCompleto: '', atividades: [{ idAtividade: 1, valorAtividade: 0, receitasAtividade: [emptyReceita()] }] }])}>
              <Plus className="h-3 w-3 mr-1" /> Estabelecimento
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Seção 5 — Valores para Comparação */}
        {comparacao && (
          <AccordionItem value="comparacao">
            <AccordionTrigger className="text-sm font-semibold">5. Valores para Comparação</AccordionTrigger>
            <AccordionContent className="space-y-3 pt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código Tributo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {valoresComparacao.map((vc, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Select value={String(vc.codigoTributo)} onValueChange={v => setValoresComparacao(prev => prev.map((x, xi) => xi === i ? { ...x, codigoTributo: parseInt(v) } : x))}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {TRIBUTO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input type="number" step="0.01" className="h-8 text-xs" value={vc.valor}
                          onChange={e => setValoresComparacao(prev => prev.map((x, xi) => xi === i ? { ...x, valor: parseFloat(e.target.value) || 0 } : x))} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-8 px-1" onClick={() => setValoresComparacao(prev => prev.filter((_, xi) => xi !== i))}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" onClick={() => setValoresComparacao(prev => [...prev, { codigoTributo: 1001, valor: 0 }])}>
                <Plus className="h-3 w-3 mr-1" /> Tributo
              </Button>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      <Button onClick={handleSubmit} disabled={loading || disabled || !pa} className="w-full">
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
        ) : (
          <><Send className="h-4 w-4 mr-2" /> Entregar Declaração</>
        )}
      </Button>
    </div>
  );
}
