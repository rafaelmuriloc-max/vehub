import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { looksLikeSciHtml, parseSciHtml } from "./sciHtml.ts";

const ficha = (empresa: string, cnpj: string, nome: string, cpf: string, rescisao = "") => `
<table>
  <tr><td colspan="4">REGISTRO DE COLABORADORES</td></tr>
  <tr><td>Raz&atilde;o Social</td><td>${empresa}</td><td>CNPJ</td><td>${cnpj}</td></tr>
  <tr><td>C&oacute;digo</td><td>00123</td><td>Contrato</td><td>Indeterminado</td></tr>
  <tr><td>Nome</td><td>${nome}</td><td>CPF</td><td>${cpf}</td></tr>
  <tr><td>Admiss&atilde;o</td><td>01/03/2024</td><td>Fun&ccedil;&atilde;o</td><td>Auxiliar Administrativo</td></tr>
  <tr><td>Sal&aacute;rio Inicial</td><td>1.850,00</td><td>Forma de Pagamento</td><td>Dep&oacute;sito</td></tr>
  <tr><td>Data de Rescis&atilde;o</td><td>${rescisao}</td><td></td><td></td></tr>
</table>`;

const html = `<html><body>
${ficha("ALFA COMERCIO LTDA", "12.345.678/0001-90", "MARIA DA SILVA", "123.456.789-09")}
${ficha("BETA SERVICOS LTDA", "98.765.432/0001-10", "JOAO PEREIRA", "987.654.321-00", "15/08/2025")}
</body></html>`;

Deno.test("detecta relatório do SCI", () => {
  assertEquals(looksLikeSciHtml(html), true);
  assertEquals(looksLikeSciHtml("<html><body>outro relatório</body></html>"), false);
});

Deno.test("extrai uma ficha por colaborador com a empresa da própria ficha", () => {
  const r = parseSciHtml(html);
  assertEquals(r.forms, 2);
  assertEquals(r.incomplete, 0);
  assertEquals(r.employees.length, 2);

  const [a, b] = r.employees;
  assertEquals(a.full_name, "MARIA DA SILVA");
  assertEquals(a.cpf, "12345678909");
  assertEquals(a.company_document, "12345678000190");
  assertEquals(a.company_name, "ALFA COMERCIO LTDA");
  assertEquals(a.position, "Auxiliar Administrativo");
  assertEquals(a.admission_date, "2024-03-01");
  assertEquals(a.salary, 1850);
  assertEquals(a.payment_method, "Depósito");
  assertEquals(a.termination_date, null);

  assertEquals(b.company_document, "98765432000110");
  assertEquals(b.full_name, "JOAO PEREIRA");
  assertEquals(b.termination_date, "2025-08-15");
});

Deno.test("ignora ficha sem nome e sem CPF", () => {
  const vazio = `<table><tr><td>REGISTRO DE COLABORADORES</td></tr>
    <tr><td>Razão Social</td><td>GAMA LTDA</td></tr></table>`;
  const r = parseSciHtml(vazio);
  assertEquals(r.forms, 1);
  assertEquals(r.employees.length, 0);
  assertEquals(r.incomplete, 1);
});
