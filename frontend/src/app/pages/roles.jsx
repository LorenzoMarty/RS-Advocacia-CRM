import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { formatCount } from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

function roleApps(role, permissionGroups) {
  return permissionGroups
    .filter((group) => group.permissions.some((permission) => role.permissionIds.includes(permission.id)))
    .map((group) => group.label);
}

function linkedUsers(users, roleId) {
  return users.filter((user) => user.roleId === roleId);
}

function validateRoleForm(form) {
  const nextErrors = {};

  if (!form.name.trim()) nextErrors.name = 'Informe o nome do cargo.';

  return nextErrors;
}

export function RolesListPage() {
  const { permissionGroups, roles, users } = useAppState();

  return (
    <>
      <PageChrome label="Cargos" />

      <div className="cargos-page">
        <section className="surface cargos-intro">
          <div className="section-head">
            <div>
              <h1 className="intro-title">Cargos</h1>
              <p className="section-note">Perfis de acesso e permissões da operação.</p>
            </div>
            <span className="badge gold">{formatCount(roles.length)}</span>
          </div>

          <div className="cargos-intro-actions">
            <Link className="btn btn-secondary" to="/usuarios">Usuários</Link>
            <Link className="btn" to="/cargos/novo">Novo cargo</Link>
          </div>
        </section>

        <section className="surface cargos-panel">
          {roles.length ? (
            <>
              <div className="cargos-head" aria-hidden="true">
                <span>Cargo</span>
                <span>Usuários</span>
                <span>Permissões</span>
                <span>Apps</span>
                <span>Ações</span>
              </div>

              <div className="cargos-list">
                {roles.map((role) => {
                  const roleUsers = linkedUsers(users, role.id);
                  const apps = roleApps(role, permissionGroups);
                  return (
                    <article key={role.id} className="cargo-row">
                      <div className="cargo-main">
                        <div className="cargo-mark" aria-hidden="true">{role.name.slice(0, 1).toUpperCase()}</div>
                        <div className="cargo-copy">
                          <h2 className="cargo-name">{role.name}</h2>
                          <p className="cargo-note">Permissões herdadas automaticamente pelos usuários com este cargo.</p>
                        </div>
                      </div>

                      <div className="cargo-stat cargo-users-stat">
                        <strong>{roleUsers.length}</strong>
                        <span>usuários</span>
                      </div>

                      <div className="cargo-stat cargo-permissions-stat">
                        <strong>{role.permissionIds.length}</strong>
                        <span>permissões</span>
                      </div>

                      <div className="cargo-apps">
                        {apps.length ? apps.map((label) => <span key={label} className="cargo-app-chip">{label}</span>) : <span className="cargo-app-chip is-empty">Sem permissões</span>}
                      </div>

                      <div className="cargo-actions">
                        <Link className="action-link" to={`/cargos/${role.id}`}>Ver</Link>
                        <Link className="action-link" to={`/cargos/${role.id}/editar`}>Editar</Link>
                        <Link className="action-link action-link-danger" to={`/cargos/${role.id}/excluir`}>Excluir</Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState title="Sem cargos disponíveis." copy="Crie o primeiro cargo para começar a organizar permissões." actions={<Link className="btn" to="/cargos/novo">Novo cargo</Link>} />
          )}
        </section>
      </div>
    </>
  );
}

export function RoleFormPage() {
  const navigate = useNavigate();
  const params = useParams();
  const isEditing = Boolean(params.roleId);
  const { permissionGroups, roles, saveRole } = useAppState();
  const role = roles.find((item) => item.id === params.roleId) || null;
  const [form, setForm] = useState(() => ({
    id: role?.id || '',
    name: role?.name || '',
    permissionIds: role?.permissionIds || [],
  }));
  const [errors, setErrors] = useState({});

  if (isEditing && !role) {
    return <NotFoundState title="Cargo não encontrado." />;
  }

  function togglePermission(permissionId) {
    setForm((currentForm) => ({
      ...currentForm,
      permissionIds: currentForm.permissionIds.includes(permissionId)
        ? currentForm.permissionIds.filter((currentPermissionId) => currentPermissionId !== permissionId)
        : [...currentForm.permissionIds, permissionId],
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateRoleForm(form);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const savedRole = saveRole({
      id: form.id || undefined,
      name: form.name.trim(),
      permissionIds: form.permissionIds,
    });

    navigate(`/cargos/${savedRole.id || form.id}`, { replace: true });
  }

  return (
    <>
      <PageChrome label={isEditing ? 'Editar cargo' : 'Novo cargo'} />

      <div className="cargo-form-page">
        <section className="surface cargo-intro">
          <div className="intro-grid">
            <Link className="intro-link" to={isEditing ? `/cargos/${role.id}` : '/cargos'}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {isEditing ? 'Voltar para o cargo' : 'Voltar para cargos'}
            </Link>
            <div className="section-head">
              <div>
                <h1 className="intro-title">{isEditing ? role.name : 'Novo cargo'}</h1>
                <p className="intro-note">
                  {isEditing ? 'Atualize o nome e as permissões deste cargo.' : 'Crie um novo cargo e defina o escopo de acesso dele.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="surface cargo-panel">
          <form className="cargo-form" onSubmit={handleSubmit}>
            <Field id="role-name" label="Nome do cargo" error={errors.name}>
              <input id="role-name" value={form.name} onChange={(event) => setForm((currentForm) => ({ ...currentForm, name: event.target.value }))} />
            </Field>

            <section className={`permissions-panel${errors.permissionIds ? ' has-error' : ''}`}>
              <div className="section-head">
                <div>
                  <h2 className="section-title">Permissões</h2>
                  <p className="section-note">Selecione exatamente o que este cargo pode fazer.</p>
                </div>
              </div>

              <div className="permissions-sections">
                {permissionGroups.map((group) => (
                  <section key={group.key} className="permission-section">
                    <div className="permission-section-head">
                      <div>
                        <h3 className="permission-section-title">{group.label}</h3>
                        <p className="permission-section-note">{group.permissions.length} permissões</p>
                      </div>
                    </div>

                    <div className="permission-grid">
                      {group.permissions.map((permission) => (
                        <label key={permission.id} className="permission-item" htmlFor={permission.id}>
                          <input
                            id={permission.id}
                            type="checkbox"
                            checked={form.permissionIds.includes(permission.id)}
                            onChange={() => togglePermission(permission.id)}
                          />
                          <span className="permission-copy">
                            <strong>{permission.displayName}</strong>
                            <span>{permission.modelLabel}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </section>

            <div className="form-actions">
              <button className="btn" type="submit">Salvar permissões</button>
              {isEditing ? <Link className="btn btn-danger" to={`/cargos/${role.id}/excluir`}>Excluir cargo</Link> : null}
              <Link className="btn btn-secondary" to={isEditing ? `/cargos/${role.id}` : '/cargos'}>Cancelar</Link>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

export function RoleDetailPage() {
  const params = useParams();
  const { permissionGroups, roles, users } = useAppState();
  const role = roles.find((item) => item.id === params.roleId) || null;

  if (!role) {
    return <NotFoundState title="Cargo não encontrado." />;
  }

  const roleUsers = linkedUsers(users, role.id);
  const sections = permissionGroups
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((permission) => role.permissionIds.includes(permission.id)),
    }))
    .filter((group) => group.permissions.length);

  return (
    <>
      <PageChrome label="Cargo" />

      <div className="cargo-detail-page">
        <section className="surface cargo-hero">
          <div className="crumbs">
            <Link to="/cargos">Cargos</Link>
          </div>

          <div className="cargo-hero-grid">
            <div className="cargo-identity">
              <div className="identity-row">
                <div className="cargo-mark" aria-hidden="true">{role.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h1 className="cargo-name">{role.name}</h1>
                  <p className="cargo-subtitle">Cargo da equipe com permissões herdadas automaticamente.</p>
                </div>
              </div>

              <aside className="hero-summary">
                <article className="summary-card">
                  <span>Usuários</span>
                  <strong>{roleUsers.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Permissões</span>
                  <strong>{role.permissionIds.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Apps</span>
                  <strong>{sections.length}</strong>
                </article>
              </aside>
            </div>
          </div>
        </section>

        <div className="cargo-layout">
          <section className="surface section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Permissões</h2>
                <p className="section-note">Agrupadas por área do sistema</p>
              </div>
            </div>

            {sections.length ? (
              <div className="permission-sections">
                {sections.map((section) => (
                  <section key={section.key} className="permission-block">
                    <div className="permission-block-head">
                      <h3>{section.label}</h3>
                      <span className="badge">{section.permissions.length} itens</span>
                    </div>

                    <div className="permission-list">
                      {section.permissions.map((permission) => (
                        <article key={permission.id} className="permission-item">
                          <strong>{permission.displayName}</strong>
                          <span>{permission.modelLabel}</span>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="note-box">Este cargo ainda não possui permissões atribuídas.</div>
            )}
          </section>

          <section className="surface section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Usuários vinculados</h2>
                <p className="section-note">Membros que herdam este acesso</p>
              </div>
            </div>

            {roleUsers.length ? (
              <div className="related-list">
                {roleUsers.map((user) => (
                  <article key={user.id} className="related-item">
                    <h3 className="related-title">{user.name}</h3>
                    <p className="related-copy">{user.email}</p>
                    <div className="related-actions">
                      <Link className="action-link" to={`/usuarios/${user.id}`}>Ver usuário</Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="note-box">Nenhum usuário está vinculado a este cargo no momento.</div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

export function RoleDeletePage() {
  const navigate = useNavigate();
  const params = useParams();
  const { deleteRole, roles, users } = useAppState();
  const role = roles.find((item) => item.id === params.roleId) || null;

  if (!role) {
    return <NotFoundState title="Cargo não encontrado." />;
  }

  const roleUsers = linkedUsers(users, role.id);
  const isBlocked = roleUsers.length > 0;

  function handleDelete(event) {
    event.preventDefault();
    if (isBlocked) {
      return;
    }

    deleteRole(role.id);
    navigate('/cargos', { replace: true });
  }

  return (
    <>
      <PageChrome label="Excluir" actions={<Link className="btn btn-secondary" to={`/cargos/${role.id}`}>Voltar</Link>} />

      <div className="confirm-page">
        <section className="surface confirm-intro">
          <div className="section-head">
            <div>
              <h1 className="confirm-title">Excluir cargo</h1>
              <p className="confirm-copy">Revise o registro antes de confirmar. A exclusão remove este item do fluxo principal.</p>
            </div>
          </div>
        </section>

        <section className="surface confirm-panel">
          <div className="confirm-box">
            <div className={`confirm-alert${isBlocked ? ' is-blocked' : ''}`}>
              <strong>{isBlocked ? 'Ação bloqueada.' : 'Ação irreversível.'}</strong>
              <p>{isBlocked ? 'Existem usuários vinculados a este cargo. Realoque esses perfis antes de excluir.' : 'Depois da confirmação, este registro não poderá ser recuperado pela interface.'}</p>
            </div>

            <div className="confirm-meta">
              <span>Registro selecionado</span>
              <strong>{role.name}</strong>
              <p>{roleUsers.length} usuários vinculados</p>
            </div>

            {isBlocked ? (
              <div className="confirm-actions">
                <Link className="btn btn-secondary" to={`/cargos/${role.id}`}>Voltar</Link>
              </div>
            ) : (
              <form onSubmit={handleDelete}>
                <div className="confirm-actions">
                  <button className="btn btn-danger" type="submit">Confirmar exclusão</button>
                  <Link className="btn btn-secondary" to={`/cargos/${role.id}`}>Cancelar</Link>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
