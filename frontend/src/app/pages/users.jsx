import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch } from '../layout';
import { useAppState } from '../store';
import { buildSearchText, formatCount, normalizeText } from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

const USER_PROFILE_OPTIONS = ['Administrador', 'Advogado', 'Estagiário'];

function profileLabel(userOrValue) {
  if (typeof userOrValue === 'string') return userOrValue || 'Sem perfil';
  return userOrValue?.roleName || userOrValue?.roleId || 'Sem perfil';
}

function validateUserForm(form, users, currentId) {
  const nextErrors = {};

  if (!form.name.trim()) nextErrors.name = 'Informe o nome.';
  if (!form.email.trim()) nextErrors.email = 'Informe o e-mail.';
  if (!form.roleId) nextErrors.roleId = 'Selecione um cargo.';
  if (users.some((user) => user.email.toLowerCase() === form.email.toLowerCase() && user.id !== currentId)) {
    nextErrors.email = 'Já existe um usuário com este e-mail.';
  }

  return nextErrors;
}

export function UsersListPage() {
  const { addFlash, currentUser, deleteUser, users } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [search, setSearch] = useState('');

  const filteredUsers = users.filter((user) =>
    buildSearchText([user.name, user.email, profileLabel(user)]).includes(normalizeText(search)),
  );

  async function handleDeleteUser(user) {
    if (currentUser?.id === user.id) {
      addFlash('Você não pode deletar o usuário da sessão atual.', 'warning');
      return;
    }

    const canDelete = await confirm({
      title: 'Tem certeza?',
      message: `O usuário "${user.name}" será deletado.`,
      confirmLabel: 'Deletar',
      tone: 'danger',
    });

    if (!canDelete) {
      return;
    }

    await deleteUser(user.id);
  }

  return (
    <>
      {confirmPopup}
      <PageChrome label="Usuários" />

      <div className="users-page">
        <section className="surface users-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Usuários</h1>
              <p className="section-note">Equipe</p>
            </div>
            <span className="badge gold">{formatCount(filteredUsers.length)}</span>
          </div>

          <div className="list-intro-toolbar">
            <PageSearch value={search} onChange={(event) => setSearch(event.target.value)} />

            <div className="list-intro-actions">
              <Link className="btn list-intro-action" to="/usuarios/novo">Novo</Link>
            </div>
          </div>
        </section>

        <section className="surface users-panel">
          {filteredUsers.length ? (
            <>
              <div className="users-head" aria-hidden="true">
                <span>Usuário</span>
                <span>Contato</span>
                <span>Perfil</span>
                <span>Ações</span>
              </div>

              <div className="users-list">
                {filteredUsers.map((user) => (
                  <article key={user.id} className="user-row">
                    <div className="user-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>

                    <div className="user-main">
                      <h2 className="user-name">{user.name}</h2>
                      <span className="user-meta">{user.email}</span>
                    </div>

                    <div className="user-contact">
                      <div className="contact-stack">
                        <a className="contact-chip" href={`mailto:${user.email}`}>{user.email}</a>
                      </div>
                    </div>

                    <div className="user-role">
                      <span className="role-badge">{profileLabel(user)}</span>
                    </div>

                    <div className="user-actions">
                      <Link className="action-link" to={`/usuarios/${user.id}`}>Ver</Link>
                      <Link className="action-link" to={`/usuarios/${user.id}/editar`}>Editar</Link>
                      <button className="action-link action-link-danger" type="button" onClick={() => handleDeleteUser(user)}>Excluir</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              title="Nenhum usuário encontrado."
              copy="Cadastre a equipe que acessa o sistema."
              actions={<Link className="btn" to="/usuarios/novo">Novo usuário</Link>}
            />
          )}
        </section>
      </div>
    </>
  );
}

export function UserFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = Boolean(params.userId);
  const { saveUser, users } = useAppState();
  const user = users.find((item) => item.id === params.userId) || null;
  const [form, setForm] = useState(() => ({
    id: user?.id || '',
    name: user?.name || '',
    email: user?.email || '',
    roleId: user?.roleId || '',
  }));
  const [errors, setErrors] = useState({});

  if (isEditing && !user) {
    return <NotFoundState title="Usuário não encontrado." />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateUserForm(form, users, form.id);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const savedUser = await saveUser({
      id: isEditing ? form.id : undefined,
      name: form.name.trim(),
      email: form.email.trim(),
      roleId: form.roleId,
    });

    if (!savedUser) {
      return;
    }

    navigate(`/usuarios/${savedUser.id || form.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar usuário' : 'Novo usuário'} />

      <div className="create-page">
        <section className="surface create-intro">
          <div className="intro-grid">
            <Link className="intro-link" to={isEditing ? `/usuarios/${user.id}` : '/usuarios'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {isEditing ? 'Voltar para o usuário' : 'Voltar para usuários'}
            </Link>
            <div className="section-head">
              <div>
                <h1 className="intro-title">{isEditing ? 'Editar usuário' : 'Novo usuário'}</h1>
                <p className="intro-note">
                  {isEditing ? 'Atualize os dados do perfil sem perder o contexto atual.' : 'Cadastre um membro da equipe e defina o perfil de acesso.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="surface form-panel">
          <form className="user-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <Field id="user-name" label="Nome" error={errors.name}>
                <input id="user-name" value={form.name} onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))} />
              </Field>

              <Field id="user-email" label="E-mail" error={errors.email}>
                <input id="user-email" type="email" value={form.email} onChange={(event) => setForm((currentForm) => ({ ...currentForm, email: event.target.value }))} />
              </Field>

              <Field
                id="user-role"
                label="Perfil"
                error={errors.roleId}
              >
                <select id="user-role" value={form.roleId} onChange={(event) => setForm((currentForm) => ({ ...currentForm, roleId: event.target.value }))}>
                  <option value="">Selecione o perfil</option>
                  {USER_PROFILE_OPTIONS.map((profile) => <option key={profile} value={profile}>{profile}</option>)}
                </select>
              </Field>

            </div>

            <div className="form-actions">
              <button className="btn" type="submit">{isEditing ? 'Atualizar' : 'Salvar'}</button>
              <Link className="btn btn-secondary" to={isEditing ? `/usuarios/${user.id}` : '/usuarios'}>Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

export function UserDetailPage() {
  const params = useParams();
  const { events, processes, users } = useAppState();
  const user = users.find((item) => item.id === params.userId) || null;

  if (!user) {
    return <NotFoundState title="Usuário não encontrado." />;
  }

  const relatedProcesses = processes.filter((process) => normalizeText(process.owner) === normalizeText(user.name));
  const relatedEvents = events.filter((event) => event.responsible === user.id);
  const linkedProfile = profileLabel(user);

  return (
    <>
      <PageChrome label="Usuário" />

      <div className="user-page">
        <section className="surface user-hero">
          <div className="crumbs">
            <Link to="/usuarios">Usuários</Link>
          </div>

          <div className="user-hero-grid">
            <div className="user-identity">
              <div className="identity-row">
                <div className="user-mark" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h1 className="user-name">{user.name}</h1>
                  <p className="user-subtitle">{user.email}</p>
                </div>
              </div>

              <aside className="hero-summary">
                <article className="summary-card">
                  <span>Perfil</span>
                  <strong>{linkedProfile}</strong>
                </article>
                <article className="summary-card">
                  <span>Processos</span>
                  <strong>{relatedProcesses.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Compromissos</span>
                  <strong>{relatedEvents.length}</strong>
                </article>
              </aside>
            </div>
          </div>
        </section>

        <div className="user-layout">
          <div className="stack">
            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Dados</h2>
                  <p className="section-note">Essenciais</p>
                </div>
              </div>

              <div className="detail-grid">
                <article className="detail-item">
                  <span>Nome</span>
                  <strong>{user.name}</strong>
                </article>
                <article className="detail-item">
                  <span>E-mail</span>
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                </article>
                <article className="detail-item">
                  <span>Perfil</span>
                  <strong>{linkedProfile}</strong>
                </article>
              </div>
            </section>

            {relatedProcesses.length ? (
              <section className="surface section-card">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Processos</h2>
                    <p className="section-note">{formatCount(relatedProcesses.length)}</p>
                  </div>
                </div>

                <div className="related-list">
                  {relatedProcesses.map((process) => (
                    <article key={process.id} className="related-item">
                      <h3 className="related-title">{process.number}</h3>
                      <p className="related-copy">{process.area}</p>
                      <div className="related-meta">
                        {process.area ? <span className="meta-chip">{process.area}</span> : null}
                        {process.status ? <span className="meta-chip">{process.status}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <div className="stack">
            {relatedEvents.length ? (
              <section className="surface section-card">
                <div className="section-head">
                  <div>
                    <h2 className="section-title">Compromissos</h2>
                    <p className="section-note">{formatCount(relatedEvents.length)}</p>
                  </div>
                </div>

                <div className="related-list">
                  {relatedEvents.map((event) => (
                    <article key={event.id} className="related-item">
                      <h3 className="related-title">{event.title}</h3>
                      <p className="related-copy">{event.start.replace('T', ' ').slice(0, 16)}</p>
                      <div className="related-meta">
                        {event.type ? <span className="meta-chip">{event.type}</span> : null}
                        {event.status ? <span className="meta-chip">{event.status}</span> : null}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

          </div>
        </div>
      </div>
    </>
  );
}
