import { Link } from "react-router-dom";

export function TermsOfServicePage() {
  return (
    <div className="policy-shell">
      <div className="policy-container">
        <header className="policy-header">
          <div className="policy-brand">
            <div className="login-brand-mark" aria-hidden="true">RS</div>
            <div>
              <div className="login-kicker">Plataforma jurídica</div>
              <strong>RS Advocacia</strong>
            </div>
          </div>
          <h1>Termos de Uso</h1>
          <p className="policy-meta">Última atualização: julho de 2026</p>
        </header>

        <main className="policy-body">
          <section>
            <h2>1. Sobre a plataforma</h2>
            <p>
              A plataforma RS Advocacia é um sistema de gestão jurídica interna,
              utilizado exclusivamente por membros do escritório para administrar
              clientes, processos, agenda, prazos, petições e reuniões.
            </p>
          </section>

          <section>
            <h2>2. Acesso</h2>
            <p>
              O acesso é restrito a usuários previamente cadastrados pelo
              administrador do escritório, autenticados via conta Google. Não há
              cadastro público ou autoatendimento.
            </p>
          </section>

          <section>
            <h2>3. Uso adequado</h2>
            <p>
              Cada usuário é responsável pelas informações que insere na plataforma e
              deve utilizá-la apenas para finalidades relacionadas à atividade do
              escritório. É vedado o uso para fins diversos dos previstos nestes
              termos.
            </p>
          </section>

          <section>
            <h2>4. Integrações Google</h2>
            <p>
              Ao autorizar a integração com Google Calendar e Google Drive, o usuário
              concorda com o uso dessas permissões conforme descrito na{" "}
              <Link to="/politica-privacidade">Política de Privacidade</Link>.
            </p>
          </section>

          <section>
            <h2>5. Disponibilidade</h2>
            <p>
              A plataforma é oferecida "como está", sem garantia de disponibilidade
              contínua. Manutenções podem ocasionar indisponibilidade temporária.
            </p>
          </section>

          <section>
            <h2>6. Alterações</h2>
            <p>
              Estes termos podem ser atualizados periodicamente. Alterações relevantes
              serão publicadas nesta página com a data de revisão atualizada.
            </p>
          </section>

          <section>
            <h2>7. Contato</h2>
            <p>
              Dúvidas sobre estes termos: entre em contato com o administrador do
              escritório responsável pela plataforma.
            </p>
          </section>
        </main>

        <footer className="policy-footer">
          <Link to="/login" className="policy-back-link">← Voltar para o login</Link>
        </footer>
      </div>
    </div>
  );
}
