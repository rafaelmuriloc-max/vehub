import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { looksLikeSciHtml, parseSciHtml } from "./sciHtml.ts";

// Formato real do SCI (FastReport): linha de rótulos seguida da linha de valores,
// alinhadas pelo colspan das células.
const ficha = (o: {
  empresa: string; cnpj: string; nome: string; cpf: string;
  funcao: string; salario: string; categoria: string; rescisao?: string;
}) => `
<table>
 <tr><td colspan="45">REGISTRO DE COLABORADORES</td></tr>
 <tr><td class="s2" colspan="36">Empregador</td><td class="s2" colspan="9">CNPJ</td></tr>
 <tr><td class="s1" colspan="36">${o.empresa}</td><td class="s1" colspan="9">${o.cnpj}</td></tr>
 <tr><td class="s2" colspan="3">C&oacute;digo</td><td class="s2" colspan="5">Contrato</td><td class="s2" colspan="37">Nome do(a) trabalhador(a)</td></tr>
 <tr><td class="s1" colspan="3">123</td><td class="s1" colspan="5">Indeterminado</td><td class="s1" colspan="37">${o.nome}</td></tr>
 <tr><td class="s2" colspan="12">CPF</td><td class="s2" colspan="10">Categoria</td></tr>
 <tr><td class="s1" colspan="12">${o.cpf}</td><td class="s1" colspan="10">${o.categoria}</td></tr>
 <tr><td class="s2" colspan="7">Data de admiss&atilde;o</td><td class="s2" colspan="8">Data do registro</td><td class="s2" colspan="25">Fun&ccedil;&atilde;o</td></tr>
 <tr><td class="s1" colspan="7">01/03/2024</td><td class="s1" colspan="8">01/03/2024</td><td class="s1" colspan="25">${o.funcao}</td></tr>
 <tr><td class="s2" colspan="7">Sal&aacute;rio Inicial</td><td class="s2" colspan="8">Forma de pagamento</td></tr>
 <tr><td class="s1" colspan="7">${o.salario}</td><td class="s1" colspan="8">Mensal</td></tr>
 <tr><td class="s2" colspan="3">Data rescis&atilde;o</td><td class="s2" colspan="9">Aviso pr&eacute;vio</td></tr>
 <tr><td class="s1" colspan="3">${o.rescisao ?? ""}</td><td class="s1" colspan="9">N&atilde;o informado</td></tr>
</table>`;

const html = `<html><body>
${ficha({ empresa: "ALFA COMERCIO LTDA", cnpj: "12.345.678/0001-90", nome: "MARIA DA SILVA", cpf: "123.456.789-09", funcao: "AUXILIAR ADMINISTRATIVO", salario: "R$ 1.850,00", categoria: "1 - Empregado" })}
${ficha({ empresa: "BETA SERVICOS LTDA", cnpj: "98.765.432/0001-10", nome: "JOAO PEREIRA", cpf: "987.654.321-00", funcao: "VENDEDOR", salario: "R$ 2.000,00", categoria: "1 - Empregado", rescisao: "15/08/2025" })}
${ficha({ empresa: "GAMA LTDA", cnpj: "11.222.333/0001-44", nome: "ANA COSTA", cpf: "111.222.333-96", funcao: "GERENTE", salario: "R$ 0,00", categoria: "11" })}
</body></html>`;

Deno.test("detecta relatório do SCI", () => {
  assertEquals(looksLikeSciHtml(html), true);
  assertEquals(looksLikeSciHtml("<html><body>outro relatório</body></html>"), false);
});

Deno.test("extrai uma ficha por colaborador com a empresa da própria ficha", () => {
  const r = parseSciHtml(html);
  assertEquals(r.forms, 3);
  assertEquals(r.incomplete, 0);
  assertEquals(r.employees.length, 3);

  const [a, b, c] = r.employees;
  assertEquals(a.full_name, "MARIA DA SILVA");
  assertEquals(a.cpf, "12345678909");
  assertEquals(a.company_document, "12345678000190");
  assertEquals(a.company_name, "ALFA COMERCIO LTDA");
  assertEquals(a.position, "AUXILIAR ADMINISTRATIVO");
  assertEquals(a.admission_date, "2024-03-01");
  assertEquals(a.salary, 1850);
  assertEquals(a.payment_method, "Mensal");
  assertEquals(a.employee_code, "123");
  assertEquals(a.termination_date, null);
  assertEquals(a.is_partner, false);

  assertEquals(b.company_document, "98765432000110");
  assertEquals(b.termination_date, "2025-08-15");

  // Sócio (categoria 11) é importado e identificado no cargo; salário zero vira 0.
  assertEquals(c.is_partner, true);
  assertEquals(c.position, "GERENTE (sócio)");
  assertEquals(c.salary, 0);
});

Deno.test("ignora ficha sem nome e sem CPF", () => {
  const vazio = `<table><tr><td>REGISTRO DE COLABORADORES</td></tr>
    <tr><td colspan="4">Empregador</td></tr><tr><td colspan="4">GAMA LTDA</td></tr></table>`;
  const r = parseSciHtml(vazio);
  assertEquals(r.forms, 1);
  assertEquals(r.employees.length, 0);
  assertEquals(r.incomplete, 1);
});
