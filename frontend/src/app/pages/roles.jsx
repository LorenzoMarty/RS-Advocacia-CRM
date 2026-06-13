import { Link, useParams } from 'react-router-dom';

import { PageChrome } from '../layout';
import { useAppState } from '../store';
import { formatCount } from '../utils';
import { EmptyState, NotFoundState } from './common';

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
  prazos: 'Prazos',
  peticoes: 'Petições ou contestações',
  productivity: 'Produtividade',
  processos: 'Processos',
  usuarios: 'Usuários',
};

const AREA_NOTES = {
  agenda: 'Compromissos, audiências e tarefas.',
  auth: 'Cargos, regras de acesso e contas internas.',
  clientes: 'Cadastro, dados e histórico dos clientes.',
  prazos: 'Prazos processuais e tarefas de protocolo.',
  peticoes: 'Petição, contestação, protocolo e acompanhamento.',
  productivity: 'Tarefas cronometradas, metas e histórico de produtividade.',
  processos: 'Processos jurídicos e seus dados principais.',
  usuarios: 'Cadastro da equipe que usa o sistema.',
};

const RESOURCE_LABELS = {
  cliente: 'Clientes',
  evento: 'Compromissos',
  group: 'Cargos',
  permission: 'Regras de acesso',
  prazo: 'Prazos',
  peticao: 'Petições ou contestações',
  productivitygoal: 'Metas de produtividade',
  processo: 'Processos',
  timeentry: 'Tarefas cronometradas',
  user: 'Contas internas',
  usuario: 'Usuários',
};

const RESOURCE_NOTES = {
  cliente: 'Dados dos clientes atendidos pelo escritório.',
  evento: 'Compromissos, audiências e tarefas da agenda.',
  group: 'Cargos usados para liberar acessos por perfil.',
  permission: 'Regras avançadas usadas pelo sistema.',
  prazo: 'Prazos processuais separados da agenda de compromissos.',
  peticao: 'Peças jurídicas separadas de prazos e compromissos.',
  productivitygoal: 'Metas diárias e semanais por usuário.',
  processo: 'Informações dos processos cadastrados.',
  timeentry: 'Sessões de trabalho registradas em tarefas.',
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

function roleUsersCount(role, users) {
  return role.usersCount ?? linkedUsers(users, role.id).length;
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
              <p className="section-note">Consulte o que cada cargo pode ver, cadastrar, editar ou excluir. A criação e a edição de cargos são feitas pelo administrador do sistema.</p>
            </div>
            <span className="badge gold">{formatCount(roles.length)}</span>
          </div>

          <div className="cargos-intro-actions">
            <Link className="btn btn-secondary" to="/usuarios">Usuários</Link>
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
                  const usersCount = roleUsersCount(role, users);
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
                        <strong>{usersCount}</strong>
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
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <EmptyState title="Sem cargos disponíveis." copy="Os cargos são criados pelo administrador do sistema e aparecem aqui para consulta." />
          )}
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
  const usersCount = roleUsersCount(role, users);
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
                  <strong>{usersCount}</strong>
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
