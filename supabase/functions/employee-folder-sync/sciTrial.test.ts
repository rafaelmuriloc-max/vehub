import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { looksLikeTrialHtml, parseTrialHtml } from "./sciTrial.ts";

const html = `<html><body>
<table>
 <tr><td colspan="50">Previs&atilde;o de t&eacute;rmino de contrato de experi&ecirc;ncia</td></tr>
 <tr><td colspan="30">ALFA COMERCIO LTDA</td><td colspan="20">12.345.678/0001-90</td></tr>
 <tr>
  <td colspan="20">Nome do(a) trabalhador(a)</td><td colspan="8">CPF</td>
  <td colspan="6">Admiss&atilde;o</td>
  <td colspan="6">1&ordm; Prazo</td><td colspan="3">Dias</td>
  <td colspan="6">2&ordm; Prazo</td><td colspan="3">Dias</td>
 </tr>
 <tr>
  <td colspan="20">MARIA DA SILVA</td><td colspan="8">123.456.789-09</td>
  <td colspan="6">01/09/2026</td>
  <td colspan="6">15/10/2026</td><td colspan="3">45</td>
  <td colspan="6">29/11/2026</td><td colspan="3">45</td>
 </tr>
 <tr>
  <td colspan="20">JOAO PEREIRA</td><td colspan="8">987.654.321-00</td>
  <td colspan="6">10/09/2026</td>
  <td colspan="6">24/10/2026</td><td colspan="3">44</td>
  <td colspan="6"></td><td colspan="3"></td>
 </tr>
 <tr><td colspan="30">BETA SERVICOS LTDA</td><td colspan="20">98.765.432/0001-10</td></tr>
 <tr>
  <td colspan="20">ANA COSTA</td><td colspan="8">111.222.333-96</td>
  <td colspan="6">05/09/2026</td>
  <td colspan="6">19/10/2026</td><td colspan="3">45</td>
  <td colspan="6">03/12/2026</td><td colspan="3">45</td>
 </tr>
</table>
</body></html>`;

Deno.test("detecta o relatório de contrato de experiência", () => {
  assertEquals(looksLikeTrialHtml(html), true);
  assertEquals(looksLikeTrialHtml("<html><body>registro de colaboradores</body></html>"), false);
});

Deno.test("lê os dois prazos por funcionário com a empresa do grupo", () => {
  const r = parseTrialHtml(html);
  assertEquals(r.employees.length, 3);

  const [a, b, c] = r.employees;
  assertEquals(a.full_name, "MARIA DA SILVA");
  assertEquals(a.cpf, "12345678909");
  assertEquals(a.admission_date, "2026-09-01");
  assertEquals(a.trial_end_1, "2026-10-15");
  assertEquals(a.trial_days_1, 45);
  assertEquals(a.trial_end_2, "2026-11-29");
  assertEquals(a.trial_days_2, 45);
  assertEquals(a.company_document, "12345678000190");
  assertEquals(a.company_name, "ALFA COMERCIO LTDA");

  assertEquals(b.trial_end_2, null);
  assertEquals(b.trial_days_2, null);

  assertEquals(c.company_document, "98765432000110");
  assertEquals(c.trial_end_1, "2026-10-19");
});
