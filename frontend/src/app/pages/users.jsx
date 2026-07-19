import { memo, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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
  RelatedItem,
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

const UserRow = memo(function UserRow({ user, onDelete }) {
  return (
    <Motion.article
      className="grid grid-cols-1 items-start gap-3 rounded-2xl border border-border bg-accent/5 p-4 transition-colors hover:border-primary/20 hover:bg-primary/5 sm:grid-cols-[auto_1fr_auto] sm:items-center lg:grid-cols-[auto_minmax(0,1.1fr)_minmax(220px,.95fr)_132px_252px]"
      variants={staggerItem}
    >
      <div
        className="hidden size-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-sm font-bold text-primary sm:grid"
        aria-hidden="true"
      >
        {user.name.slice(0, 1).toUpperCase()}
      </div>

      <div className="min-w-0">
        <h2 className="text-base font-semibold leading-snug text-foreground">{user.name}</h2>
        <span className="mt-1.5 block text-sm text-muted-foreground">{user.email}</span>
      </div>

      <div className="min-w-0">
        <a
          className="inline-flex h-8 max-w-full items-center truncate rounded-full border border-border bg-accent/10 px-2.5 text-sm text-soft"
          href={`mailto:${user.email}`}
        >
          {user.email}
        </a>
      </div>

      <div className="min-w-0">
        <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
          {profileLabel(user)}
        </Badge>
      </div>

      <div className="flex min-w-0 flex-wrap items-start justify-end gap-2 lg:justify-center">
        <Button asChild variant="outline" size="sm">
          <Link to={`/usuarios/${user.id}`}>Ver</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/usuarios/${user.id}/editar`}>Editar</Link>
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => onDelete(user)}>
          Excluir
        </Button>
      </div>
    </Motion.article>
  );
});

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

      <div className="grid gap-4">
        <section className="mb-2">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-serif text-3xl text-foreground">Usuários</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatCount(filteredUsers.length)}</p>
            </div>
            <Button asChild>
              <Link to="/usuarios/novo" data-tour="page-primary-action">
                <Plus className="size-4" />
                Novo
              </Link>
            </Button>
          </div>
        </section>

        <Card>
          <CardContent className="py-4">
            <PageSearch value={search} onChange={(event) => setSearch(event.target.value)} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-5">
          {isLoadingUsers ? (
            <div className="grid gap-2.5">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : filteredUsers.length ? (
            <>
              <div
                className="mb-3 hidden grid-cols-[auto_minmax(0,1.1fr)_minmax(220px,.95fr)_132px_252px] gap-3.5 px-3.5 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid"
                aria-hidden="true"
              >
                <span />
                <span>Usuário</span>
                <span>Contato</span>
                <span>Perfil</span>
                <span className="text-center">Ações</span>
              </div>

              <Motion.div
                className="grid gap-2.5"
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
              >
                {filteredUsers.map((user) => (
                  <UserRow key={user.id} user={user} onDelete={handleDeleteUser} />
                ))}
              </Motion.div>

              {usersPagination.temMais && !search ? (
                <div className="mt-4 flex justify-center">
                  <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Carregando…' : 'Carregar mais'}
                  </Button>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="Nenhum usuário encontrado."
              copy="Cadastre a equipe que acessa o sistema."
              actions={<Button asChild size="sm"><Link to="/usuarios/novo">Novo usuário</Link></Button>}
            />
          )}
          </CardContent>
        </Card>
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

      <div className="grid gap-4">
        <section className="mb-2">
          <p className="font-serif text-3xl text-foreground">
            {isEditing ? 'Editar usuário' : 'Novo usuário'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isEditing ? 'Atualize os dados do perfil sem perder o contexto atual.' : 'Cadastre um membro da equipe e defina o perfil de acesso.'}
          </p>

          <Link
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            to={isEditing ? `/usuarios/${user.id}` : '/usuarios'}
          >
            <ArrowLeft className="size-3.5" />
            {isEditing ? 'Voltar para o usuário' : 'Voltar para usuários'}
          </Link>
        </section>

        <Card>
          <CardContent className="py-5">
          <form className="user-form" onSubmit={handleSubmit(onSubmit)}>
            <div className="form-grid">
              <Field id="user-name" label="Nome" error={errors.name?.message} required>
                <input id="user-name" {...register('name')} />
              </Field>

              <Field id="user-email" label="E-mail" error={errors.email?.message} required>
                <input id="user-email" type="email" autoComplete="email" {...register('email')} />
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
              <Button type="submit" disabled={isSubmitting}>{isEditing ? 'Atualizar' : 'Salvar'}</Button>
              <Button asChild variant="outline">
                <Link to={isEditing ? `/usuarios/${user.id}` : '/usuarios'}>Cancelar</Link>
              </Button>
            </div>
          </form>
          </CardContent>
        </Card>
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
                <div className="flex flex-col gap-2">
                  {relatedProcesses.map((process) => (
                    <RelatedItem
                      key={process.id}
                      title={process.number}
                      subtitle={process.area}
                      chips={[process.area, process.status].filter(Boolean)}
                    />
                  ))}
                </div>
              </DetailSection>
            ) : null}
          </DetailStack>

          <DetailStack>
            {relatedEvents.length ? (
              <DetailSection title="Compromissos" note={formatCount(relatedEvents.length)}>
                <div className="flex flex-col gap-2">
                  {relatedEvents.map((event) => (
                    <RelatedItem
                      key={event.id}
                      title={event.title}
                      subtitle={event.start.replace('T', ' ').slice(0, 16)}
                      chips={[event.type, event.status].filter(Boolean)}
                    />
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
