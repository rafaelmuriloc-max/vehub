

# Mover Checkboxes de Obrigações para as Abas Corretas

## Problema
Os checkboxes de obrigações estão na aba "Contatos", agrupados por departamento. Mas devem estar nas abas correspondentes: obrigações do departamento "Fiscal" na aba Fiscal, do "Pessoal" na aba Pessoal, etc.

## Mudanças

### Arquivo: `src/pages/Clients.tsx`

1. **Remover** o bloco de checkboxes de obrigações da aba "Contatos" (o trecho que filtra `allObligations` por `dep.id` e renderiza checkboxes dentro do loop de departamentos).

2. **Adicionar** em cada aba de departamento (Fiscal, Pessoal, Societário, Sucesso) uma seção "Obrigações" no final, com checkboxes filtrados pelo `department_id` correspondente. A lógica precisa mapear o nome do departamento ao tab:
   - Buscar o departamento cujo `name` corresponde à aba (ex: "Fiscal", "Pessoal", "Societário", "Sucesso")
   - Filtrar `allObligations` por esse `department_id`
   - Renderizar os checkboxes usando o mesmo padrão já existente (`selectedObligations` Set + `Checkbox`)

3. **Criar helper reutilizável** para evitar duplicação -- uma função inline ou pequeno componente que recebe o nome do departamento e renderiza a seção de checkboxes:

```text
function renderDeptObligations(deptName: string) {
  const dept = departments.find(d => d.name.toLowerCase().includes(deptName));
  if (!dept) return null;
  const obls = allObligations.filter(o => o.department_id === dept.id);
  if (obls.length === 0) return null;
  return (
    <div className="col-span-2 space-y-2 border-t pt-4 mt-2">
      <Label className="text-base font-semibold">Obrigações</Label>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {obls.map(obl => (
          <Checkbox + Label para cada obrigação>
        ))}
      </div>
    </div>
  );
}
```

4. **Inserir** `renderDeptObligations('fiscal')` no final da TabsContent "fiscal", `renderDeptObligations('pessoal')` no final da "pessoal", etc.

### Detalhes técnicos
- O mapeamento tab→departamento usa `departments` (já carregado no state) buscando por nome
- Nenhuma mudança no banco de dados -- a tabela `client_department_obligations` já está correta
- A lógica de save permanece idêntica (já salva por `obligation_id` + `department_id`)

