import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";

import { GuestLayout, ProtectedLayout } from "./app/layout";
import { AppStateProvider } from "./app/store";
import { LoginPage } from "./app/pages/auth";
import { DashboardPage } from "./app/pages/dashboard";
import {
  ClientsListPage,
  ClientFormPage,
  ClientDetailPage,
} from "./app/pages/clients";
import {
  ProcessesListPage,
  ProcessFormPage,
  ProcessDetailPage,
} from "./app/pages/processes";
import {
  AgendaListPage,
  AgendaDayPage,
  EventFormPage,
  EventDetailPage,
} from "./app/pages/agendas";
import {
  DeadlineDetailPage,
  DeadlineFormPage,
  DeadlinesPage,
} from "./app/pages/deadlines";
import { PetitionFormPage, PetitionsPage } from "./app/pages/petitions";
import {
  UsersListPage,
  UserFormPage,
  UserDetailPage,
} from "./app/pages/users";
import { ProductivityPage } from "./app/pages/productivity/ProductivityPage";
import {
  ProspectKanbanPage,
  ProspectFormPage,
  ProspectDetailPage,
} from "./app/pages/prospeccao";
import { FinanceiroPage, LancamentoFormPage } from "./app/pages/financeiro";
import { AuditPage } from "./app/pages/audit";
import { useAppState } from "./app/store";
import { ApiTestPage } from "./app/pages/api-test";
import { MeetingsPage } from "./app/pages/meetings";
import { PrivacyPolicyPage } from "./app/pages/privacy-policy";

function ClientFormRoute() {
  const { clientId } = useParams();
  return <ClientFormPage key={clientId || "client-new"} />;
}

function ProcessFormRoute() {
  const { processId } = useParams();
  const location = useLocation();
  return (
    <ProcessFormPage key={processId || `process-new-${location.search}`} />
  );
}

function EventFormRoute() {
  const { eventId } = useParams();
  const location = useLocation();
  return <EventFormPage key={eventId || `event-new-${location.search}`} />;
}

function DeadlineFormRoute() {
  const { deadlineId } = useParams();
  const location = useLocation();
  return <DeadlineFormPage key={deadlineId || `deadline-new-${location.search}`} />;
}

function PetitionFormRoute() {
  const { petitionId } = useParams();
  return <PetitionFormPage key={petitionId || "petition-new"} />;
}

function UserFormRoute() {
  const { userId } = useParams();
  return <UserFormPage key={userId || "user-new"} />;
}

function ProspectFormRoute() {
  const { prospectId } = useParams();
  return <ProspectFormPage key={prospectId || "prospect-new"} />;
}

function LancamentoFormRoute() {
  const { lancamentoId } = useParams();
  return <LancamentoFormPage key={lancamentoId || "lancamento-new"} />;
}

function RequirePermission({ permission, children }) {
  const { hasPermission } = useAppState();
  if (!hasPermission(permission)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <AppStateProvider>
      <HashRouter>
        <Routes>
          <Route element={<GuestLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<ProtectedLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/api-test" element={<ApiTestPage />} />

            <Route path="/clientes" element={<ClientsListPage />} />
            <Route path="/clientes/novo" element={<ClientFormRoute />} />
            <Route path="/clientes/:clientId" element={<ClientDetailPage />} />
            <Route
              path="/clientes/:clientId/editar"
              element={<ClientFormRoute />}
            />

            <Route path="/processos" element={<ProcessesListPage />} />
            <Route path="/processos/novo" element={<ProcessFormRoute />} />
            <Route
              path="/processos/:processId"
              element={<ProcessDetailPage />}
            />
            <Route
              path="/processos/:processId/editar"
              element={<ProcessFormRoute />}
            />

            <Route path="/agenda" element={<AgendaListPage />} />
            <Route path="/agenda/novo" element={<EventFormRoute />} />
            <Route path="/agenda/dia/:date" element={<AgendaDayPage />} />
            <Route path="/agenda/:eventId" element={<EventDetailPage />} />
            <Route
              path="/agenda/:eventId/editar"
              element={<EventFormRoute />}
            />

            <Route path="/prazos" element={<DeadlinesPage />} />
            <Route path="/prazos/novo" element={<DeadlineFormRoute />} />
            <Route path="/prazos/:deadlineId" element={<DeadlineDetailPage />} />
            <Route path="/prazos/:deadlineId/editar" element={<DeadlineFormRoute />} />

            <Route path="/peticoes-contestacoes" element={<PetitionsPage />} />
            <Route path="/peticoes-contestacoes/novo" element={<PetitionFormRoute />} />
            <Route path="/peticoes-contestacoes/:petitionId/editar" element={<PetitionFormRoute />} />

            <Route path="/reunioes" element={<MeetingsPage />} />
            <Route path="/produtividade" element={<ProductivityPage />} />

            <Route path="/prospeccao" element={<ProspectKanbanPage />} />
            <Route path="/prospeccao/novo" element={<ProspectFormRoute />} />
            <Route path="/prospeccao/:prospectId" element={<ProspectDetailPage />} />
            <Route path="/prospeccao/:prospectId/editar" element={<ProspectFormRoute />} />

            <Route
              path="/financeiro"
              element={
                <RequirePermission permission="financeiro.view_lancamento">
                  <FinanceiroPage />
                </RequirePermission>
              }
            />
            <Route
              path="/financeiro/novo"
              element={
                <RequirePermission permission="financeiro.add_lancamento">
                  <LancamentoFormRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/financeiro/:lancamentoId/editar"
              element={
                <RequirePermission permission="financeiro.change_lancamento">
                  <LancamentoFormRoute />
                </RequirePermission>
              }
            />

            <Route path="/auditoria" element={<AuditPage />} />

            <Route
              path="/usuarios"
              element={
                <RequirePermission permission="usuarios.view_usuario">
                  <UsersListPage />
                </RequirePermission>
              }
            />
            <Route
              path="/usuarios/novo"
              element={
                <RequirePermission permission="usuarios.add_usuario">
                  <UserFormRoute />
                </RequirePermission>
              }
            />
            <Route
              path="/usuarios/:userId"
              element={
                <RequirePermission permission="usuarios.view_usuario">
                  <UserDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="/usuarios/:userId/editar"
              element={
                <RequirePermission permission="usuarios.change_usuario">
                  <UserFormRoute />
                </RequirePermission>
              }
            />

          </Route>

          <Route path="/politica-privacidade" element={<PrivacyPolicyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppStateProvider>
  );
}
