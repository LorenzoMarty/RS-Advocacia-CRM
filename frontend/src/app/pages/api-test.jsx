import { useEffect, useState } from 'react';

import { apiRequest } from '../api';
import { PageChrome } from '../layout';
import { Field } from './common';

const API_URL = '/api/test/';

export function ApiTestPage() {
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function loadItems() {
    setIsLoading(true);
    setMessage('');

    try {
      const data = await apiRequest(API_URL);
      setItems(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao buscar dados.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage('Informe um nome.');
      return;
    }

    setIsSaving(true);
    setMessage('');

    try {
      const data = await apiRequest(API_URL, {
        method: 'POST',
        body: JSON.stringify({ nome: trimmedName }),
      });
      setName('');
      setItems((currentItems) => [data, ...currentItems]);
      setMessage('Nome salvo com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao salvar dados.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <PageChrome label="Teste API" />

      <div className="api-test-page">
        <section className="surface api-test-hero">
          <span className="badge gold">Integração Django</span>
          <h1>Teste de integração</h1>
          <p>Envie um nome e veja a resposta salva pelo Django.</p>
        </section>

        <section className="surface form-panel">
          <form className="api-test-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <Field id="api-test-name" label="Nome">
                <input
                  id="api-test-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Miguel"
                />
              </Field>
            </div>

            <div className="form-actions">
              <button className="btn" type="submit" disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
              <button className="btn btn-secondary" type="button" onClick={loadItems} disabled={isLoading}>
                Atualizar lista
              </button>
            </div>
          </form>
        </section>

        {message ? <p className="form-message">{message}</p> : null}

        <section className="surface api-test-list">
          {isLoading ? <p>Carregando...</p> : null}
          {!isLoading && !items.length ? <p>Nenhum nome cadastrado.</p> : null}
          {items.map((item) => (
            <article className="api-test-item" key={item.id}>
              <strong>{item.nome}</strong>
              <span>{item.criado_em ? new Date(item.criado_em).toLocaleString('pt-BR') : '-'}</span>
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
