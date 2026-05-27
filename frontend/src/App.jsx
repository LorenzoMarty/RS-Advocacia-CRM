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
import {
  RolesListPage,
  RoleFormPage,
  RoleDetailPage,
} from "./app/pages/roles";
import { OfficeProductivityPage } from "./app/components/productivity";
import { AuditPage } from "./app/pages/audit";
import { ApiTestPage } from "./app/pages/api-test";
import { MeetingsPage } from "./app/pages/meetings";

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

function RoleFormRoute() {
  const { roleId } = useParams();
  return <RoleFormPage key={roleId || "role-new"} />;
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
            <Route path="/produtividade" element={<OfficeProductivityPage />} />
            <Route path="/auditoria" element={<AuditPage />} />

            <Route path="/usuarios" element={<UsersListPage />} />
            <Route path="/usuarios/novo" element={<UserFormRoute />} />
            <Route path="/usuarios/:userId" element={<UserDetailPage />} />
            <Route
              path="/usuarios/:userId/editar"
              element={<UserFormRoute />}
            />

            <Route path="/cargos" element={<RolesListPage />} />
            <Route path="/cargos/novo" element={<RoleFormRoute />} />
            <Route path="/cargos/:roleId" element={<RoleDetailPage />} />
            <Route path="/cargos/:roleId/editar" element={<RoleFormRoute />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppStateProvider>
  );
}
