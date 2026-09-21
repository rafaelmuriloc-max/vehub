import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { looksLikeTrialHtml, parseTrialHtml } from "./sciTrial.ts";

// Formato real do SCI (FastReport): um bloco por empresa, com grade de colaboradores.
const row = (cells: [string, number][]) =>
  `<tr>${cells.map(([t, w]) => `<td colspan="${w}">${t}</td>`).join("")}</tr>`;

const header = row([
  ["C&oacute;digo", 1],
  ["Colaborador", 3],
  ["Data Adm.", 1],
  ["Data Venc.", 3],
  ["Prazo", 1],
  ["Data Venc.", 2],
  ["Prazo", 1],
]);

const html = `<html><body><table>
${row([["Previs&atilde;o de Contrato de Experi&ecirc;ncia - Per&iacute;odo de 01/09/2026 at&eacute; 31/12/2026", 10]])}
${row([["Empresa: 16 - POUSADA DO PESCADOR LTDA", 7], ["Penha/SC - CNPJ:42.466.142/0001-99", 5]])}
${header}
${row([["52", 1], ["RUAN DOS SANTOS ONOFRE", 3], ["07/07/2026", 1], ["20/08/2026", 3], ["45", 1], ["04/10/2026", 2], ["45", 1]])}
${row([["53", 1], ["MARIA DA SILVA", 3], ["30/07/2026", 1], ["12/09/2026", 3], ["45", 1], ["", 2], ["", 1]])}
${row([["Total de colaboradores: ", 6], ["2", 2]])}
${row([["Empresa: 45 - BAIA DOS CORAIS POUSADA LTDA", 7], ["Penha/SC - CNPJ:45.400.075/0001-06", 5]])}
${header}
${row([["43", 1], ["BRUNA ALESSANDRA MENEZES PINTO", 3], ["04/08/2026", 1], ["17/09/2026", 3], ["45", 1], ["01/11/2026", 2], ["45", 1]])}
</table></body></html>`;

Deno.test("detecta o relatório de contrato de experiência", () => {
  assertEquals(looksLikeTrialHtml(html), true);
  assertEquals(looksLikeTrialHtml("<html><body>registro de colaboradores</body></html>"), false);
});

Deno.test("lê os dois prazos por colaborador com a empresa do bloco", () => {
  const r = parseTrialHtml(html);
  assertEquals(r.employees.length, 3);

  const [a, b, c] = r.employees;
  assertEquals(a.full_name, "RUAN DOS SANTOS ONOFRE");
  assertEquals(a.employee_code, "52");
  assertEquals(a.admission_date, "2026-07-07");
  assertEquals(a.trial_end_1, "2026-08-20");
  assertEquals(a.trial_days_1, 45);
  assertEquals(a.trial_end_2, "2026-10-04");
  assertEquals(a.trial_days_2, 45);
  assertEquals(a.company_document, "42466142000199");
  assertEquals(a.company_name, "POUSADA DO PESCADOR LTDA");
  assertEquals(a.company_code, "16");

  assertEquals(b.trial_end_2, null);
  assertEquals(b.trial_days_2, null);

  assertEquals(c.company_document, "45400075000106");
  assertEquals(c.company_name, "BAIA DOS CORAIS POUSADA LTDA");
  assertEquals(c.trial_end_1, "2026-09-17");
});
