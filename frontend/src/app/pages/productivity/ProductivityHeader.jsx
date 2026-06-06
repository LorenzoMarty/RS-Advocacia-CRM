import { PeriodFilter } from './PeriodFilter';

// Cabeçalho sticky: título + filtro de período + (admin) seletor de usuário.
export function ProductivityHeader({
  title,
  subtitle,
  period,
  setPeriod,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  isAdmin,
  users,
  selectedUserId,
  setSelectedUserId,
}) {
  return (
    <header className="pd-header">
      <div className="pd-header-titles">
        <h1 className="pd-title">{title}</h1>
        {subtitle ? <p className="pd-subtitle">{subtitle}</p> : null}
      </div>
      <div className="pd-header-controls">
        {isAdmin && users.length ? (
          <select
            className="pd-user-select"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            aria-label="Filtrar por usuário"
          >
            <option value="">Todo o escritório</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        ) : null}
        <PeriodFilter
          period={period}
          setPeriod={setPeriod}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>
    </header>
  );
}
