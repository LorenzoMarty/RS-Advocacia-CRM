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
  ClientDeletePage,
} from "./app/pages/clients";
import {
  ProcessesListPage,
  ProcessFormPage,
  ProcessDetailPage,
  ProcessDeletePage,
} from "./app/pages/processes";
import {
  AgendaListPage,
  EventFormPage,
  EventDetailPage,
  EventDeletePage,
} from "./app/pages/agendas";
import {
  UsersListPage,
  UserFormPage,
  UserDetailPage,
  UserDeletePage,
} from "./app/pages/users";
import {
  RolesListPage,
  RoleFormPage,
  RoleDetailPage,
  RoleDeletePage,
} from "./app/pages/roles";
import { ApiTestPage } from "./app/pages/api-test";

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
            <Route
              path="/clientes/:clientId/excluir"
              element={<ClientDeletePage />}
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
            <Route
              path="/processos/:processId/excluir"
              element={<ProcessDeletePage />}
            />

            <Route path="/agenda" element={<AgendaListPage />} />
            <Route path="/agenda/novo" element={<EventFormRoute />} />
            <Route path="/agenda/:eventId" element={<EventDetailPage />} />
            <Route
              path="/agenda/:eventId/editar"
              element={<EventFormRoute />}
            />
            <Route
              path="/agenda/:eventId/excluir"
              element={<EventDeletePage />}
            />

            <Route path="/usuarios" element={<UsersListPage />} />
            <Route path="/usuarios/novo" element={<UserFormRoute />} />
            <Route path="/usuarios/:userId" element={<UserDetailPage />} />
            <Route
              path="/usuarios/:userId/editar"
              element={<UserFormRoute />}
            />
            <Route
              path="/usuarios/:userId/excluir"
              element={<UserDeletePage />}
            />

            <Route path="/cargos" element={<RolesListPage />} />
            <Route path="/cargos/novo" element={<RoleFormRoute />} />
            <Route path="/cargos/:roleId" element={<RoleDetailPage />} />
            <Route path="/cargos/:roleId/editar" element={<RoleFormRoute />} />
            <Route
              path="/cargos/:roleId/excluir"
              element={<RoleDeletePage />}
            />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AppStateProvider>
  );
}
