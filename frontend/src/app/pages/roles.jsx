import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { formatCount } from '../utils';
import { EmptyState, Field, NotFoundState } from './common';

const ACTION_ORDER = ['view', 'create', 'edit', 'delete'];

const ACTION_LABELS = {
  add: 'Cadastrar',
  change: 'Editar',
  create: 'Cadastrar',
  delete: 'Excluir',
  edit: 'Editar',
  view: 'Ver',
};

const ACTION_NOTES = {
  create: 'Criar novo',
  delete: 'Remover',
  edit: 'Alterar',
  view: 'Consultar',
};

const AREA_LABELS = {
  agenda: 'Agenda',
  auth: 'Cargos e acessos',
  clientes: 'Clientes',
  processos: 'Processos',
  usuarios: 'Usuários',
};

const AREA_NOTES = {
  agenda: 'Compromissos, prazos, audiências e tarefas.',
  auth: 'Cargos, regras de acesso e contas internas.',
  clientes: 'Cadastro, dados e histórico dos clientes.',
  processos: 'Processos jurídicos e seus dados principais.',
  usuarios: 'Cadastro da equipe que usa o sistema.',
};

const RESOURCE_LABELS = {
  cliente: 'Clientes',
  evento: 'Compromissos',
  group: 'Cargos',
  permission: 'Regras de acesso',
  processo: 'Processos',
  user: 'Contas internas',
  usuario: 'Usuários',
};

const RESOURCE_NOTES = {
  cliente: 'Dados dos clientes atendidos pelo escritório.',
  evento: 'Itens da agenda, como prazos e audiências.',
  group: 'Cargos usados para liberar acessos por perfil.',
  permission: 'Regras avançadas usadas pelo sistema.',
  processo: 'Informações dos processos cadastrados.',
  user: 'Contas técnicas de autenticação.',
  usuario: 'Pessoas da equipe cadastradas no sistema.',
};

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function titleFromKey(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function permissionParts(permission) {
  const codename = String(permission.path || '').split('.').pop() || '';
  const [rawAction, ...rawResource] = codename.split('_');
  const action = ACTION_LABELS[permission.action] ? permission.action : rawAction;
  const actionKey = {
    add: 'create',
    change: 'edit',
  }[action] || action || 'view';
  const resourceKey = rawResource.join('_') || normalizeKey(permission.modelLabel || permission.displayName);

  return { actionKey, resourceKey };
}

function permissionIdSet(role) {
  return new Set((role.permissionIds || []).map(String));
}

function actionRank(actionKey) {
  const index = ACTION_ORDER.indexOf(actionKey);
  return index === -1 ? ACTION_ORDER.length : index;
}

function buildPermissionSections(permissionGroups) {
  return permissionGroups
    .map((group) => {
      const resourcesByKey = new Map();

      (group.permissions || []).forEach((permission) => {
        const { actionKey, resourceKey } = permissionParts(permission);
        const normalizedResourceKey = normalizeKey(resourceKey);

        if (!resourcesByKey.has(normalizedResourceKey)) {
          resourcesByKey.set(normalizedResourceKey, {
            key: normalizedResourceKey,
            label: RESOURCE_LABELS[normalizedResourceKey] || titleFromKey(normalizedResourceKey),
            note: RESOURCE_NOTES[normalizedResourceKey] || 'Acesso a esta área do sistema.',
            permissions: [],
          });
        }

        resourcesByKey.get(normalizedResourceKey).permissions.push({
          ...permission,
          id: String(permission.id),
          actionKey,
          actionLabel: ACTION_LABELS[actionKey] || titleFromKey(actionKey),
          actionNote: ACTION_NOTES[actionKey] || 'Permitir ação',
        });
      });

      const resources = [...resourcesByKey.values()]
        .map((resource) => ({
          ...resource,
          permissions: resource.permissions.sort(
            (left, right) => actionRank(left.actionKey) - actionRank(right.actionKey),
          ),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));

      return {
        key: group.key,
        label: AREA_LABELS[group.key] || group.label || titleFromKey(group.key),
        note: AREA_NOTES[group.key] || 'Acessos desta parte do sistema.',
        resources,
      };
    })
    .filter((section) => section.resources.length);
}

function sectionPermissionIds(section) {
  return section.resources.flatMap((resource) => resource.permissions.map((permission) => permission.id));
}

function selectedPermissionSections(role, permissionGroups) {
  const selectedIds = permissionIdSet(role);

  return buildPermissionSections(permissionGroups)
    .map((section) => ({
      ...section,
      resources: section.resources
        .map((resource) => ({
          ...resource,
          permissions: resource.permissions.filter((permission) => selectedIds.has(permission.id)),
        }))
        .filter((resource) => resource.permissions.length),
    }))
    .filter((section) => section.resources.length);
}

function roleAreas(role, permissionGroups) {
  return selectedPermissionSections(role, permissionGroups).map((section) => section.label);
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
              <p className="section-note">Defina o que cada pessoa pode ver, cadastrar, editar ou excluir.</p>
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
                <span>Acessos</span>
                <span>Áreas</span>
                <span>Ações</span>
              </div>

              <div className="cargos-list">
                {roles.map((role) => {
                  const roleUsers = linkedUsers(users, role.id);
                  const areas = roleAreas(role, permissionGroups);
                  return (
                    <article key={role.id} className="cargo-row">
                      <div className="cargo-main">
                        <div className="cargo-mark" aria-hidden="true">{role.name.slice(0, 1).toUpperCase()}</div>
                        <div className="cargo-copy">
                          <h2 className="cargo-name">{role.name}</h2>
                          <p className="cargo-note">Quem recebe este cargo herda os acessos marcados aqui.</p>
                        </div>
                      </div>

                      <div className="cargo-stat cargo-users-stat">
                        <strong>{roleUsers.length}</strong>
                        <span>usuários</span>
                      </div>

                      <div className="cargo-stat cargo-permissions-stat">
                        <strong>{role.permissionIds.length}</strong>
                        <span>acessos</span>
                      </div>

                      <div className="cargo-apps">
                        {areas.length ? areas.map((label) => <span key={label} className="cargo-app-chip">{label}</span>) : <span className="cargo-app-chip is-empty">Sem acessos</span>}
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
            <EmptyState title="Sem cargos disponíveis." copy="Crie o primeiro cargo para organizar os acessos da equipe." actions={<Link className="btn" to="/cargos/novo">Novo cargo</Link>} />
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
  const permissionSections = buildPermissionSections(permissionGroups);
  const selectedPermissionIds = new Set(form.permissionIds.map(String));

  if (isEditing && !role) {
    return <NotFoundState title="Cargo não encontrado." />;
  }

  function setPermissionSelection(permissionIds, shouldSelect) {
    setForm((currentForm) => ({
      ...currentForm,
      permissionIds: [
        ...permissionIds.reduce((nextPermissionIds, permissionId) => {
          if (shouldSelect) {
            nextPermissionIds.add(String(permissionId));
          } else {
            nextPermissionIds.delete(String(permissionId));
          }
          return nextPermissionIds;
        }, new Set(currentForm.permissionIds.map(String))),
      ],
    }));
  }

  function togglePermission(permissionId) {
    setPermissionSelection([permissionId], !selectedPermissionIds.has(String(permissionId)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateRoleForm(form);

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const savedRole = await saveRole({
      id: form.id || undefined,
      name: form.name.trim(),
      permissionIds: form.permissionIds,
    });

    if (!savedRole) {
      return;
    }

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
                  {isEditing ? 'Atualize o nome e os acessos deste cargo.' : 'Crie um cargo e escolha as ações liberadas para ele.'}
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
                  <h2 className="section-title">Acessos do cargo</h2>
                  <p className="section-note">Marque as ações que este cargo pode fazer em cada área.</p>
                </div>
              </div>

              <p className="permission-guide">Dica: marque Ver quando a pessoa precisar abrir a área no menu.</p>

              {permissionSections.length ? (
                <div className="permissions-sections">
                  {permissionSections.map((section) => {
                    const ids = sectionPermissionIds(section);
                    const selectedCount = ids.filter((id) => selectedPermissionIds.has(id)).length;
                    const isFullySelected = ids.length > 0 && selectedCount === ids.length;

                    return (
                      <section key={section.key} className="permission-section">
                        <div className="permission-section-head">
                          <div>
                            <h3 className="permission-section-title">{section.label}</h3>
                            <p className="permission-section-note">{section.note}</p>
                          </div>
                          <div className="permission-section-tools">
                            <span>{selectedCount} de {ids.length}</span>
                            <button type="button" onClick={() => setPermissionSelection(ids, !isFullySelected)}>
                              {isFullySelected ? 'Limpar área' : 'Marcar área'}
                            </button>
                          </div>
                        </div>

                        <div className="permission-resource-list">
                          {section.resources.map((resource) => (
                            <article key={resource.key} className="permission-resource">
                              <div className="permission-resource-copy">
                                <h4>{resource.label}</h4>
                                <p>{resource.note}</p>
                              </div>

                              <div className="permission-action-grid">
                                {resource.permissions.map((permission) => (
                                  <label
                                    key={permission.id}
                                    className={`permission-action-option permission-action-${permission.actionKey}`}
                                    htmlFor={`permission-${permission.id}`}
                                  >
                                    <input
                                      id={`permission-${permission.id}`}
                                      type="checkbox"
                                      checked={selectedPermissionIds.has(permission.id)}
                                      onChange={() => togglePermission(permission.id)}
                                    />
                                    <span>
                                      <strong>{permission.actionLabel}</strong>
                                      <small>{permission.actionNote}</small>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </article>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              ) : (
                <div className="selection-empty">As permissões ainda não foram carregadas.</div>
              )}
            </section>

            <div className="form-actions">
              <button className="btn" type="submit">Salvar cargo</button>
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
  const sections = selectedPermissionSections(role, permissionGroups);

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
                  <p className="cargo-subtitle">Acessos herdados automaticamente por quem tem este cargo.</p>
                </div>
              </div>

              <aside className="hero-summary">
                <article className="summary-card">
                  <span>Usuários</span>
                  <strong>{roleUsers.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Acessos</span>
                  <strong>{role.permissionIds.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Áreas</span>
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
                <h2 className="section-title">O que este cargo pode fazer</h2>
                <p className="section-note">Acessos organizados por área</p>
              </div>
            </div>

            {sections.length ? (
              <div className="permission-summary-sections">
                {sections.map((section) => (
                  <section key={section.key} className="permission-summary-section">
                    <div className="permission-summary-head">
                      <div>
                        <h3>{section.label}</h3>
                        <p>{section.note}</p>
                      </div>
                      <span className="badge">{sectionPermissionIds(section).length} acessos</span>
                    </div>

                    <div className="permission-summary-list">
                      {section.resources.map((resource) => (
                        <article key={resource.key} className="permission-summary-row">
                          <div>
                            <strong>{resource.label}</strong>
                            <span>{resource.note}</span>
                          </div>
                          <div className="permission-action-chips">
                            {resource.permissions.map((permission) => (
                              <span key={permission.id} className={`permission-action-chip permission-action-${permission.actionKey}`}>
                                {permission.actionLabel}
                              </span>
                            ))}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="note-box">Este cargo ainda não possui acessos liberados.</div>
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

  async function handleDelete(event) {
    event.preventDefault();
    if (isBlocked) {
      return;
    }

    const wasDeleted = await deleteRole(role.id);
    if (!wasDeleted) {
      return;
    }
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
