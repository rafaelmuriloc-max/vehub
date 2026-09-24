import { assertEquals } from "jsr:@std/assert@1";
import { parsePayrollHtml } from "./sciPayroll.ts";

const html = `<html><body><table>
<tr><td>Espelho e resumo da folha mensal referente ao mês de AGOSTO/2026</td></tr>
<tr><td>Empresa: 255 - AUDITTIVA LTDA</td></tr><tr><td>Navegantes/SC - CNPJ:65.770.630/0001-90</td></tr>
<tr><td>RESUMO GERAL</td><td>COLABORADORES</td></tr>
<tr><td>Quantidade</td><td>2</td><td>1</td><td>1</td><td>0</td><td>0</td></tr>
<tr><td>Proventos</td><td>3.503,26</td><td>1.882,02</td><td>1.621,24</td><td>0,00</td><td>0,00</td></tr>
<tr><td>Líquido</td><td>2.314,00</td><td>872,00</td><td>1.442,00</td><td>0,00</td><td>0,00</td></tr>
<tr><td>Valor GFD Mensal 8%</td><td>150,56</td><td>150,56</td><td>0,00</td><td>0,00</td><td>0,00</td></tr>
<tr><td>Ativos: 2</td><td>Admitidos: 1</td><td>Demitidos: 0</td></tr>
<tr><td>GPS - &gt;</td><td>323,37 (Bruto)</td></tr>
</table></body></html>`;

Deno.test("lê o resumo geral por empresa", () => {
  const r = parsePayrollHtml(html);
  assertEquals(r.competence, "2026-08-01");
  assertEquals(r.summaries.length, 1);
  const s = r.summaries[0];
  assertEquals(s.company_document, "65.770.630/0001-90");
  assertEquals(s.qty_total, 2);
  assertEquals(s.gross, 3503.26);
  assertEquals(s.net, 2314);
  assertEquals(s.fgts_value, 150.56);
  assertEquals(s.inss_value, 323.37);
  assertEquals(s.active_count, 2);
  assertEquals(s.admitted_count, 1);
});

Deno.test("lê salário base dos funcionários no arquivo real", () => {
  let real: string;
  try { real = Deno.readTextFileSync("/mnt/user-uploads/RELATORIO_ESPELHO_RESUMO.html"); } catch { return; }
  const r = parsePayrollHtml(real);
  const all = r.summaries.flatMap((s) => s.employees);
  const joao = all.find((e) => e.name === "JOAO VITOR PALMEIRA");
  assertEquals(joao?.base_salary, 1621);
  assertEquals(joao?.code, "1");
  assertEquals(joao?.admission_date, "2024-11-01");
  console.log("funcionários lidos:", all.length, "sem salário:", all.filter((e) => !e.base_salary).length);
});
