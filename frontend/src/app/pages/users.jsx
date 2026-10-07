import { memo, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
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

const LIST_GRID = 'grid-cols-[minmax(180px,1.4fr)_minmax(180px,1.2fr)_minmax(120px,.8fr)_minmax(150px,auto)]';

const UserRow = memo(function UserRow({ user, onDelete }) {
  return (
    <Motion.article
      className={`grid items-center gap-3 rounded-md px-3.5 py-3 transition-colors hover:bg-surface-2 ${LIST_GRID}`}
      variants={staggerItem}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={user.name} seed={user.id} size={40} />
        <h2 className="m-0 min-w-0 truncate text-[1rem] font-bold text-ink">{user.name}</h2>
      </div>

      <a className="min-w-0 truncate text-meta font-semibold text-ink-2 hover:text-ink" href={`mailto:${user.email}`}>
        {user.email}
      </a>

      <div className="min-w-0">
        <Badge variant="outline" className="border-transparent bg-accent-soft-2 px-2.5 py-1 text-[.86rem] text-[var(--accent-hover)]">
          {profileLabel(user)}
        </Badge>
      </div>

      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <Button asChild variant="outline" size="sm">
          <Link to={`/usuarios/${user.id}`}>Ver</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link to={`/usuarios/${user.id}/editar`}>Editar</Link>
        </Button>
        <Button variant="destructive" size="sm" onClick={() => onDelete(user)}>
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
      <PageChrome label="Usuários" primaryAction={{ label: 'Novo usuário', to: '/usuarios/novo', tour: 'page-primary-action' }} />

      <div className="flex flex-col gap-4">
        <PageHeader title="Usuários" subtitle={formatCount(filteredUsers.length)}>
          <PageSearch className="on-bg" value={search} onChange={(event) => setSearch(event.target.value)} label="Buscar usuários" />
        </PageHeader>

        <section className="rounded-lg bg-card px-3 pb-2 pt-3" aria-label="Lista de usuários">
          {isLoadingUsers ? (
            <div className="grid gap-2.5 p-2">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : filteredUsers.length ? (
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className={`grid gap-3 px-3.5 py-3 text-label uppercase text-subtle ${LIST_GRID}`} aria-hidden="true">
                  <span>Usuário</span>
                  <span>Contato</span>
                  <span>Perfil</span>
                  <span className="text-right">Ações</span>
                </div>

                <Motion.div
                  className="grid gap-0.5"
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredUsers.map((user) => (
                    <UserRow key={user.id} user={user} onDelete={handleDeleteUser} />
                  ))}
                </Motion.div>
              </div>

              {usersPagination.temMais && !search ? (
                <div className="flex justify-center p-3">
                  <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Carregando…' : 'Carregar mais'}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              title="Nenhum usuário encontrado."
              copy="Cadastre a equipe que acessa o sistema."
              actions={<Button asChild size="sm"><Link to="/usuarios/novo">Novo usuário</Link></Button>}
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

      <div className="grid gap-4">
        <section className="mb-2">
          <p className="text-page-title text-ink">
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
