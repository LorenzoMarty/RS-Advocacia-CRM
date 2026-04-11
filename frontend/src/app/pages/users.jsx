import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageChrome, PageSearch } from '../layout';
import { useAppState } from '../store';
import { buildSearchText, formatCount, normalizeText } from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

function roleLabel(roles, roleId) {
  return roles.find((role) => role.id === roleId)?.name || 'Sem cargo';
}

function validateUserForm(form, users, currentId) {
  const nextErrors = {};

  if (!form.name.trim()) nextErrors.name = 'Informe o nome.';
  if (!form.email.trim()) nextErrors.email = 'Informe o email.';
  if (!form.roleId) nextErrors.roleId = 'Selecione um cargo.';
  if (!currentId && !form.password.trim()) nextErrors.password = 'Informe a senha.';
  if (users.some((user) => user.email.toLowerCase() === form.email.toLowerCase() && user.id !== currentId)) {
    nextErrors.email = 'Já existe um usuário com este email.';
  }

  return nextErrors;
}

export function UsersListPage() {
  const { roles, users } = useAppState();
  const [search, setSearch] = useState('');

  const filteredUsers = users.filter((user) =>
    buildSearchText([user.name, user.email, roleLabel(roles, user.roleId)]).includes(normalizeText(search)),
  );

  return (
    <>
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
              <Link className="btn btn-secondary list-intro-action" to="/cargos">Cargos</Link>
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
                      <span className="role-badge">{roleLabel(roles, user.roleId)}</span>
                    </div>

                    <div className="user-actions">
                      <Link className="action-link" to={`/usuarios/${user.id}`}>Ver</Link>
                      <Link className="action-link" to={`/usuarios/${user.id}/editar`}>Editar</Link>
                      <Link className="action-link action-link-danger" to={`/usuarios/${user.id}/excluir`}>Excluir</Link>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="Nenhum usuário encontrado." copy="Ajuste a busca para localizar o registro desejado." actions={<Link className="btn" to="/usuarios/novo">Novo</Link>} />
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
  const { roles, saveUser, users } = useAppState();
  const user = users.find((item) => item.id === params.userId) || null;
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState(() => ({
    id: user?.id || '',
    name: user?.name || '',
    email: user?.email || '',
    roleId: user?.roleId || '',
    password: '',
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
      id: form.id || undefined,
      name: form.name.trim(),
      email: form.email.trim(),
      roleId: form.roleId,
      password: form.password,
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
                  {isEditing ? 'Atualize os dados do perfil sem perder o contexto atual.' : 'Cadastro direto da equipe.'}
                </p>
                <p className="intro-note">O cargo define automaticamente as permissões herdadas no sistema.</p>
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

              <Field id="user-email" label="Email" error={errors.email}>
                <input id="user-email" type="email" value={form.email} onChange={(event) => setForm((currentForm) => ({ ...currentForm, email: event.target.value }))} />
              </Field>

              <Field
                id="user-role"
                label="Cargo"
                error={errors.roleId}
                headLink={<Link className="field-link" to="/cargos/novo">Criar cargo</Link>}
                note="Se o cargo ainda não existir, crie-o e volte para selecionar aqui."
              >
                <select id="user-role" value={form.roleId} onChange={(event) => setForm((currentForm) => ({ ...currentForm, roleId: event.target.value }))}>
                  <option value="">Selecione o cargo</option>
                  {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </Field>

              <Field
                id="user-password"
                label="Senha"
                error={errors.password}
                note={isEditing ? 'Deixe em branco para manter a senha atual.' : null}
              >
                <div className="password-wrap">
                  <input
                    id="user-password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(event) => setForm((currentForm) => ({ ...currentForm, password: event.target.value }))}
                  />
                  <button
                    className={`password-toggle${showPassword ? ' is-visible' : ''}`}
                    type="button"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((currentValue) => !currentValue)}
                  >
                    <svg className="icon-show" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <svg className="icon-hide" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m3 3 18 18" />
                      <path d="M10.6 10.7a3 3 0 0 0 4.2 4.2" />
                      <path d="M9.4 5.5A10.7 10.7 0 0 1 12 5c6.4 0 10 7 10 7a17.7 17.7 0 0 1-3 3.8" />
                      <path d="M6.6 6.7C4 8.4 2 12 2 12a17.3 17.3 0 0 0 5.1 5.2" />
                    </svg>
                  </button>
                </div>
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
  const { events, processes, roles, users } = useAppState();
  const user = users.find((item) => item.id === params.userId) || null;

  if (!user) {
    return <NotFoundState title="Usuário não encontrado." />;
  }

  const relatedProcesses = processes.filter((process) => normalizeText(process.owner) === normalizeText(user.name));
  const relatedEvents = events.filter((event) => normalizeText(event.responsible) === normalizeText(user.name));
  const linkedRole = roles.find((role) => role.id === user.roleId) || null;

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
                  <strong>{linkedRole?.name || 'Sem cargo'}</strong>
                </article>
                <article className="summary-card">
                  <span>Processos</span>
                  <strong>{relatedProcesses.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Agenda</span>
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
                  <span>Email</span>
                  <a href={`mailto:${user.email}`}>{user.email}</a>
                </article>
                <article className="detail-item">
                  <span>Cargo</span>
                  <strong>{linkedRole?.name || 'Sem cargo'}</strong>
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

            <section className="surface section-card">
              <div className="section-head">
                <div>
                  <h2 className="section-title">Cargo</h2>
                  <p className="section-note">Permissões vinculadas</p>
                </div>
              </div>

              {linkedRole ? (
                <>
                  <div className="cargo-list">
                    <Link className="meta-chip cargo-chip" to={`/cargos/${linkedRole.id}`}>{linkedRole.name}</Link>
                  </div>
                  <div className="note-box">{linkedRole.permissionIds.length} permissões herdadas pelo cargo atribuído a este usuário.</div>
                </>
              ) : (
                <div className="note-box">Este usuário ainda não possui um cargo vinculado.</div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

export function UserDeletePage() {
  const navigate = useNavigate();
  const params = useParams();
  const { currentUser, deleteUser, roles, users } = useAppState();
  const user = users.find((item) => item.id === params.userId) || null;

  if (!user) {
    return <NotFoundState title="Usuário não encontrado." />;
  }

  const isBlocked = currentUser?.id === user.id;

  async function handleDelete(event) {
    event.preventDefault();
    if (isBlocked) {
      return;
    }

    const wasDeleted = await deleteUser(user.id);
    if (!wasDeleted) {
      return;
    }
    navigate('/usuarios', { replace: true });
  }

  return (
    <>
      <PageChrome label="Excluir" actions={<Link className="btn btn-secondary" to={`/usuarios/${user.id}`}>Voltar</Link>} />

      <div className="confirm-page">
        <section className="surface confirm-intro">
          <div className="section-head">
            <div>
              <h1 className="confirm-title">Excluir usuário</h1>
              <p className="confirm-copy">Revise o registro antes de confirmar. A exclusão remove este item do fluxo principal.</p>
            </div>
          </div>
        </section>

        <section className="surface confirm-panel">
          <div className="confirm-box">
            <div className={`confirm-alert${isBlocked ? ' is-blocked' : ''}`}>
              <strong>{isBlocked ? 'Ação bloqueada.' : 'Ação irreversível.'}</strong>
              <p>{isBlocked ? 'Você não pode excluir o usuário que está utilizando a sessão atual.' : 'Depois da confirmação, este registro não poderá ser recuperado pela interface.'}</p>
            </div>

            <div className="confirm-meta">
              <span>Registro selecionado</span>
              <strong>{user.name}</strong>
              <p>{roleLabel(roles, user.roleId)}</p>
            </div>

            {isBlocked ? (
              <div className="confirm-actions">
                <Link className="btn btn-secondary" to={`/usuarios/${user.id}`}>Voltar</Link>
              </div>
            ) : (
              <form onSubmit={handleDelete}>
                <div className="confirm-actions">
                  <button className="btn btn-danger" type="submit">Confirmar exclusão</button>
                  <Link className="btn btn-secondary" to={`/usuarios/${user.id}`}>Cancelar</Link>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
