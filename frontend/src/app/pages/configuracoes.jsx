import { useEffect, useState } from 'react';
import { KeyRound, Sparkles, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

import { api } from '../api';
import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { DetailGrid, DetailItem } from './common';

const OPERACAO_LABELS = {
  transcricao: 'Transcrição',
  resumo: 'Resumo',
  refine: 'Refinamento de resumo',
  drive: 'Classificação/organização de Drive',
};

function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(value) || 0);
}

function errorText(error) {
  return error instanceof Error ? error.message : 'Não foi possível comunicar com a API.';
}

export function ConfiguracoesPage() {
  const { addFlash } = useAppState();
  const [loading, setLoading] = useState(true);
  const [configurada, setConfigurada] = useState(false);
  const [apiKeyMascarada, setApiKeyMascarada] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [custo, setCusto] = useState(null);
  const [custoLoading, setCustoLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.getConfiguracaoIA(), api.getCustoIA()])
      .then(([configResponse, custoResponse]) => {
        if (!active) return;
        const configDados = configResponse?.dados || configResponse;
        const custoDados = custoResponse?.dados || custoResponse;
        setConfigurada(Boolean(configDados.configurada));
        setApiKeyMascarada(configDados.api_key_mascarada || '');
        setCusto(custoDados);
      })
      .catch((error) => {
        if (!active) return;
        addFlash(errorText(error), 'error');
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setCustoLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSalvar(event) {
    event.preventDefault();
    const valor = apiKeyInput.trim();
    if (!valor || salvando) return;
    setSalvando(true);
    try {
      const response = await api.salvarConfiguracaoIA(valor);
      const dados = response?.dados || response;
      setConfigurada(Boolean(dados.configurada));
      setApiKeyMascarada(dados.api_key_mascarada || '');
      setApiKeyInput('');
      addFlash('API key salva com sucesso.', 'success');
    } catch (error) {
      addFlash(errorText(error), 'error');
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover() {
    const ok = window.confirm(
      'Remover a API key cadastrada? Os recursos de IA ficam indisponíveis até cadastrar outra.',
    );
    if (!ok) return;
    try {
      await api.removerConfiguracaoIA();
      setConfigurada(false);
      setApiKeyMascarada('');
      addFlash('API key removida.', 'success');
    } catch (error) {
      addFlash(errorText(error), 'error');
    }
  }

  return (
    <>
      <PageChrome label="Configurações" />

      <div className="grid gap-4">
        <section className="mb-2">
          <p className="font-serif text-3xl text-foreground">Configurações</p>
          <p className="mt-1 text-sm text-muted-foreground">
            API key da OpenAI e custo estimado de uso de IA do escritório.
          </p>
        </section>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <KeyRound className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-serif text-lg text-foreground">API key da OpenAI</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {loading ? (
              <Skeleton className="h-10 w-full max-w-sm" />
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {configurada ? (
                    <>Key cadastrada: <span className="font-medium text-foreground">{apiKeyMascarada}</span></>
                  ) : (
                    'Nenhuma API key cadastrada — recursos de IA (transcrição, resumo, organizar com IA) ficam indisponíveis até cadastrar uma.'
                  )}
                </p>
                <form className="flex flex-wrap items-center gap-2" onSubmit={handleSalvar}>
                  <Input
                    type="password"
                    className="max-w-sm"
                    placeholder="sk-..."
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                    disabled={salvando}
                    autoComplete="off"
                  />
                  <Button type="submit" size="sm" disabled={!apiKeyInput.trim() || salvando}>
                    {salvando ? 'Salvando…' : configurada ? 'Trocar key' : 'Salvar key'}
                  </Button>
                  {configurada ? (
                    <Button type="button" variant="outline" size="sm" onClick={handleRemover}>
                      <Trash2 className="size-4" />
                      Remover
                    </Button>
                  ) : null}
                </form>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            <h2 className="font-serif text-lg text-foreground">Custo estimado de IA</h2>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {custoLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <>
                <DetailGrid>
                  <DetailItem label="Total acumulado">{formatUsd(custo?.total_usd)}</DetailItem>
                  <DetailItem label="Mês atual">{formatUsd(custo?.mes_atual_usd)}</DetailItem>
                  <DetailItem label="Mês anterior">{formatUsd(custo?.mes_anterior_usd)}</DetailItem>
                </DetailGrid>

                {custo?.por_operacao?.length ? (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-xs uppercase tracking-wide text-muted-foreground">
                      Por tipo de operação
                    </h3>
                    {custo.por_operacao.map((item) => (
                      <div
                        key={item.operacao}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-accent/5 px-3.5 py-2.5 text-sm"
                      >
                        <span className="text-foreground">
                          {OPERACAO_LABELS[item.operacao] || item.operacao}
                        </span>
                        <span className="text-muted-foreground">
                          {item.tokens_entrada + item.tokens_saida} tokens ·{' '}
                          <span className="font-medium text-foreground">{formatUsd(item.custo_usd)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum uso de IA registrado ainda.</p>
                )}

                <p className="text-xs text-muted-foreground">
                  Estimativa calculada a partir dos tokens registrados por chamada e uma tabela de
                  preço por modelo — não é o valor exato da fatura da OpenAI.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
