import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { looksLikeVacationHtml, parseVacationHtml } from "./sciVacation.ts";

const HTML = `<html><body>
<table>
<tr><td colspan="10" class="s2">Acompanhamento de vencimento de f&eacute;rias</td><td colspan="2">P&aacute;gina: 1</td></tr>
<tr><td colspan="8">Empresa: 195 - CAMIM LTDA</td><td colspan="4">Penha/SC - CNPJ:60.234.590/0001-49</td></tr>
<tr><td colspan="2">Cod.</td><td colspan="2">Nome do colaborador</td><td>Dias de direito</td><td>Referente Per&iacute;odo Aquisitivo</td><td colspan="3">Dever&aacute; gozar as f&eacute;rias entre o per&iacute;odo</td><td colspan="3">Prazo final p/ iniciar as f&eacute;rias sem gerar dobro</td></tr>
<tr><td colspan="2">1</td><td colspan="2">AISANNETH DEL VALLE CALDERON SUAREZ</td><td>30,00</td><td>22/09/2025 a 21/09/2026</td><td colspan="3">22/09/2026 a 21/09/2027</td><td colspan="3">&nbsp;</td></tr>
<tr><td colspan="2">10</td><td colspan="2">MARIA CARLA ALVES CARDOSO</td><td>27,50</td><td>05/08/2025 a 04/08/2026</td><td colspan="3">05/08/2026 a 04/08/2027</td><td colspan="3">06/07/2027</td></tr>
</table></body></html>`;

Deno.test("reconhece o relatório de férias", () => {
  assertEquals(looksLikeVacationHtml(HTML), true);
});

Deno.test("lê os períodos de férias", () => {
  const r = parseVacationHtml(HTML);
  assertEquals(r.periods.length, 2);
  assertEquals(r.incomplete, 0);
  const [a, b] = r.periods;
  assertEquals(a.employee_code, "1");
  assertEquals(a.full_name, "AISANNETH DEL VALLE CALDERON SUAREZ");
  assertEquals(a.days_right, 30);
  assertEquals(a.acquisition_start, "2025-09-22");
  assertEquals(a.acquisition_end, "2026-09-21");
  assertEquals(a.enjoy_start, "2026-09-22");
  assertEquals(a.enjoy_end, "2027-09-21");
  assertEquals(a.deadline_date, null);
  assertEquals(a.company_document, "60234590000149");
  assertEquals(a.company_code, "195");
  assertEquals(b.days_right, 27.5);
  assertEquals(b.deadline_date, "2027-07-06");
});
