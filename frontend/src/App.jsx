import { lazy, Suspense } from "react";
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
import { AppErrorBoundary } from "./app/components/ErrorBoundary";
import { useAppState } from "./app/store";

const LoginPage = lazy(() =>
  import("./app/pages/auth").then((m) => ({ default: m.LoginPage })),
);
const DashboardPage = lazy(() =>
  import("./app/pages/dashboard").then((m) => ({ default: m.DashboardPage })),
);
const ClientsListPage = lazy(() =>
  import("./app/pages/clients").then((m) => ({ default: m.ClientsListPage })),
);
const ClientFormPage = lazy(() =>
  import("./app/pages/clients").then((m) => ({ default: m.ClientFormPage })),
);
const ClientDetailPage = lazy(() =>
  import("./app/pages/clients").then((m) => ({ default: m.ClientDetailPage })),
);
const ProcessesListPage = lazy(() =>
  import("./app/pages/processes").then((m) => ({
    default: m.ProcessesListPage,
  })),
);
const ProcessFormPage = lazy(() =>
  import("./app/pages/processes").then((m) => ({ default: m.ProcessFormPage })),
);
const ProcessDetailPage = lazy(() =>
  import("./app/pages/processes").then((m) => ({
    default: m.ProcessDetailPage,
  })),
);
const AgendaListPage = lazy(() =>
  import("./app/pages/agendas").then((m) => ({ default: m.AgendaListPage })),
);
const AgendaDayPage = lazy(() =>
  import("./app/pages/agendas").then((m) => ({ default: m.AgendaDayPage })),
);
const EventFormPage = lazy(() =>
  import("./app/pages/agendas").then((m) => ({ default: m.EventFormPage })),
);
const EventDetailPage = lazy(() =>
  import("./app/pages/agendas").then((m) => ({ default: m.EventDetailPage })),
);
const DeadlineDetailPage = lazy(() =>
  import("./app/pages/deadlines").then((m) => ({
    default: m.DeadlineDetailPage,
  })),
);
const DeadlineFormPage = lazy(() =>
  import("./app/pages/deadlines").then((m) => ({
    default: m.DeadlineFormPage,
  })),
);
const DeadlinesPage = lazy(() =>
  import("./app/pages/deadlines").then((m) => ({ default: m.DeadlinesPage })),
);
const PetitionFormPage = lazy(() =>
  import("./app/pages/petitions").then((m) => ({
    default: m.PetitionFormPage,
  })),
);
const PetitionsPage = lazy(() =>
  import("./app/pages/petitions").then((m) => ({ default: m.PetitionsPage })),
);
const UsersListPage = lazy(() =>
  import("./app/pages/users").then((m) => ({ default: m.UsersListPage })),
);
const UserFormPage = lazy(() =>
  import("./app/pages/users").then((m) => ({ default: m.UserFormPage })),
);
const UserDetailPage = lazy(() =>
  import("./app/pages/users").then((m) => ({ default: m.UserDetailPage })),
);
const ProductivityPage = lazy(() =>
  import("./app/pages/productivity/ProductivityPage").then((m) => ({
    default: m.ProductivityPage,
  })),
);
const ProspectKanbanPage = lazy(() =>
  import("./app/pages/prospeccao").then((m) => ({
    default: m.ProspectKanbanPage,
  })),
);
const ProspectFormPage = lazy(() =>
  import("./app/pages/prospeccao").then((m) => ({
    default: m.ProspectFormPage,
  })),
);
const ProspectDetailPage = lazy(() =>
  import("./app/pages/prospeccao").then((m) => ({
    default: m.ProspectDetailPage,
  })),
);
const FinanceiroPage = lazy(() =>
  import("./app/pages/financeiro").then((m) => ({ default: m.FinanceiroPage })),
);
const LancamentoFormPage = lazy(() =>
  import("./app/pages/financeiro").then((m) => ({
    default: m.LancamentoFormPage,
  })),
);
const AuditPage = lazy(() =>
  import("./app/pages/audit").then((m) => ({ default: m.AuditPage })),
);
const MeetingsPage = lazy(() =>
  import("./app/pages/meetings").then((m) => ({ default: m.MeetingsPage })),
);
const PrivacyPolicyPage = lazy(() =>
  import("./app/pages/privacy-policy").then((m) => ({
    default: m.PrivacyPolicyPage,
  })),
);
const TermsOfServicePage = lazy(() =>
  import("./app/pages/terms-of-service").then((m) => ({
    default: m.TermsOfServicePage,
  })),
);

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
    <AppErrorBoundary>
      <AppStateProvider>
      <HashRouter>
        <Suspense fallback={null}>
        <Routes>
          <Route element={<GuestLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<ProtectedLayout />}>
            <Route index element={<DashboardPage />} />

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
          <Route path="/termos-de-uso" element={<TermsOfServicePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </HashRouter>
      </AppStateProvider>
    </AppErrorBoundary>
  );
}
