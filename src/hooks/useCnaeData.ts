import { useState, useEffect, useRef } from 'react';

export interface CnaeItem {
  id: string;
  descricao: string;
  label: string;
}

let cachedData: CnaeItem[] | null = null;

export function useCnaeData() {
  const [data, setData] = useState<CnaeItem[]>(cachedData || []);
  const [loading, setLoading] = useState(!cachedData);
  const fetched = useRef(false);

  useEffect(() => {
    if (cachedData || fetched.current) return;
    fetched.current = true;
    setLoading(true);

    fetch('https://servicodados.ibge.gov.br/api/v2/cnae/subclasses')
      .then(res => res.json())
      .then((raw: any[]) => {
        const items: CnaeItem[] = raw.map(item => ({
          id: String(item.id),
          descricao: item.descricao,
          label: `${item.id} - ${item.descricao}`,
        }));
        cachedData = items;
        setData(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
