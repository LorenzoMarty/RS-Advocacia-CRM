import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useConfirmPopup } from '../hooks/use-confirm-popup';
import { PageChrome, PageSearch } from '../layout';
import { motion as Motion, staggerContainer, staggerItem } from '../motion';
import { useAppState } from '../store';
import { buildSearchText, formatCount, normalizeText } from '../utils';
import { Select } from '../components/select';
import {
  DetailGrid,
  DetailHero,
  DetailItem,
  DetailLayout,
  DetailSection,
  DetailStack,
  EmptyState,
  Field,
  NotFoundState,
} from './common';

const USER_PROFILE_OPTIONS = ['Administrador', 'Advogado', 'Estagiário'];

function profileLabel(userOrValue) {
  if (typeof userOrValue === 'string') return userOrValue || 'Sem perfil';
  return userOrValue?.roleName || userOrValue?.roleId || 'Sem perfil';
}

function buildUserSchema(users, currentId) {
  return z.object({
    name: z.string().min(1, 'Informe o nome.'),
    email: z.string().min(1, 'Informe o e-mail.'),
    roleId: z.string().min(1, 'Selecione um cargo.'),
  }).superRefine((data, ctx) => {
    const emailTaken = users.some(
      (user) => user.email.toLowerCase() === data.email.toLowerCase() && user.id !== currentId,
    );
    if (emailTaken) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['email'], message: 'Já existe um usuário com este e-mail.' });
    }
  });
}

export function UsersListPage() {
  const {
    addFlash,
    currentUser,
    deleteUser,
    loadMoreUsers,
    loadUsers,
    users,
    usersPagination,
  } = useAppState();
  const { confirm, confirmPopup } = useConfirmPopup();
  const [search, setSearch] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Busca própria e paginada, independente do teto de segurança do bootstrap
  // (core/views.py inicializacao) — busca por nome/email ainda é client-side
  // sobre as páginas já carregadas, o backend de usuários não filtra por texto.
  // Loading local (não o isLoading global do bootstrap): sem isso, a tela
  // mostra "Nenhum usuário encontrado" por um instante antes deste fetch
  // próprio terminar — exatamente o flash que essa tela corrigiu antes.
  useEffect(() => {
    let isMounted = true;
    setIsLoadingUsers(true);
    loadUsers().finally(() => {
      if (isMounted) setIsLoadingUsers(false);
    });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = users.filter((user) =>
    buildSearchText([user.name, user.email, profileLabel(user)]).includes(normalizeText(search)),
  );

  async function handleLoadMore() {
    setLoadingMore(true);
    try {
      await loadMoreUsers();
    } finally {
      setLoadingMore(false);
    }
  }

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
              <Link className="btn list-intro-action" to="/usuarios/novo" data-tour="page-primary-action">Novo</Link>
            </div>
          </div>
        </section>

        <section className="surface users-panel">
          {isLoadingUsers ? (
            <div className="skeleton-stack">
              <span className="skeleton" style={{ height: 56 }} />
              <span className="skeleton" style={{ height: 56 }} />
              <span className="skeleton" style={{ height: 56 }} />
            </div>
          ) : filteredUsers.length ? (
            <>
              <div className="users-head" aria-hidden="true">
                <span>Usuário</span>
                <span>Contato</span>
                <span>Perfil</span>
                <span>Ações</span>
              </div>

              <Motion.div
                className="users-list"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {filteredUsers.map((user) => (
                  <Motion.article key={user.id} className="user-row" variants={staggerItem}>
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
                  </Motion.article>
                ))}
              </Motion.div>

              {usersPagination.temMais && !search ? (
                <div className="list-load-more">
                  <button className="btn btn-secondary" type="button" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Carregando...' : 'Carregar mais'}
                  </button>
                </div>
              ) : null}
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

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(buildUserSchema(users, user?.id)),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      roleId: user?.roleId ?? '',
    },
  });

  // defaultValues só é lido no primeiro render do useForm — quando o usuário
  // chega depois (fetch assíncrono), precisa de reset() explícito.
  useEffect(() => {
    if (!user) return;
    reset({
      name: user.name ?? '',
      email: user.email ?? '',
      roleId: user.roleId ?? '',
    });
  }, [user, reset]);

  if (isEditing && !user) {
    return <NotFoundState title="Usuário não encontrado." />;
  }

  async function onSubmit(data) {
    const savedUser = await saveUser({
      id: isEditing ? user.id : undefined,
      name: data.name.trim(),
      email: data.email.trim(),
      roleId: data.roleId,
    });

    if (!savedUser) {
      return;
    }

    navigate(`/usuarios/${savedUser.id || user?.id}`, { replace: true });
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
          <form className="user-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="form-grid">
              <Field id="user-name" label="Nome" error={errors.name?.message} required>
                <input id="user-name" {...register('name')} />
              </Field>

              <Field id="user-email" label="E-mail" error={errors.email?.message} required>
                <input id="user-email" type="email" {...register('email')} />
              </Field>

              <Field
                id="user-role"
                label="Perfil"
                error={errors.roleId?.message}
                required
              >
                <Select id="user-role" {...register('roleId')}>
                  <option value="">Selecione o perfil</option>
                  {USER_PROFILE_OPTIONS.map((profile) => <option key={profile} value={profile}>{profile}</option>)}
                </Select>
              </Field>

            </div>

            <div className="form-actions">
              <button className="btn" type="submit" disabled={isSubmitting}>{isEditing ? 'Atualizar' : 'Salvar'}</button>
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

      <div className="grid gap-4">
        <DetailHero
          breadcrumbLabel="Usuários"
          breadcrumbTo="/usuarios"
          mark={user.name.slice(0, 1).toUpperCase()}
          title={user.name}
          subtitle={user.email}
          summary={[
            { label: 'Perfil', value: linkedProfile },
            { label: 'Processos', value: relatedProcesses.length },
            { label: 'Compromissos', value: relatedEvents.length },
          ]}
        />

        <DetailLayout>
          <DetailStack>
            <DetailSection title="Dados" note="Essenciais">
              <DetailGrid>
                <DetailItem label="Nome">{user.name}</DetailItem>
                <DetailItem label="E-mail">
                  <a className="hover:text-primary" href={`mailto:${user.email}`}>{user.email}</a>
                </DetailItem>
                <DetailItem label="Perfil">{linkedProfile}</DetailItem>
              </DetailGrid>
            </DetailSection>

            {relatedProcesses.length ? (
              <DetailSection title="Processos" note={formatCount(relatedProcesses.length)}>
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
              </DetailSection>
            ) : null}
          </DetailStack>

          <DetailStack>
            {relatedEvents.length ? (
              <DetailSection title="Compromissos" note={formatCount(relatedEvents.length)}>
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
              </DetailSection>
            ) : null}
          </DetailStack>
        </DetailLayout>
      </div>
    </>
  );
}
