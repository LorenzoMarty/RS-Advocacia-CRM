import { Link } from "react-router-dom";

export function PrivacyPolicyPage() {
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
          <h1>Política de Privacidade</h1>
          <p className="policy-meta">Última atualização: junho de 2025</p>
        </header>

        <main className="policy-body">
          <section>
            <h2>1. Responsável pelo tratamento</h2>
            <p>
              RS Advocacia é responsável pelo tratamento dos dados pessoais
              coletados por meio desta plataforma, utilizada exclusivamente pelos
              membros do escritório para gestão interna de clientes, processos,
              agenda e documentos.
            </p>
          </section>

          <section>
            <h2>2. Dados coletados via Google</h2>
            <p>Para autenticação e integração com os serviços Google, solicitamos as seguintes permissões:</p>
            <table className="policy-table">
              <thead>
                <tr>
                  <th>Permissão</th>
                  <th>Finalidade</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>openid · email · profile</code></td>
                  <td>Identificação do usuário: nome, e-mail e foto de perfil, utilizados para criar e autenticar a conta na plataforma.</td>
                </tr>
                <tr>
                  <td><code>calendar.events</code></td>
                  <td>Leitura e escrita de eventos no Google Calendar do usuário. Permite sincronizar compromissos criados na plataforma com o calendário Google e receber atualizações em tempo real via webhook.</td>
                </tr>
                <tr>
                  <td><code>drive.file</code></td>
                  <td>Acesso restrito apenas aos arquivos criados pelo aplicativo no Google Drive do usuário. Utilizado para armazenar gravações de reuniões e documentos de clientes. O aplicativo não acessa outros arquivos do Drive.</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2>3. Como os dados são armazenados</h2>
            <p>
              Os tokens de acesso emitidos pelo Google são armazenados de forma cifrada
              no banco de dados da plataforma (criptografia AES-128/Fernet). Nenhum token
              é exposto em logs ou transmitido a terceiros.
            </p>
            <p>
              Arquivos enviados ao Google Drive ficam na conta Google do próprio usuário.
              Armazenamos apenas os metadados (nome e ID do arquivo) para referência interna.
            </p>
          </section>

          <section>
            <h2>4. Compartilhamento de dados</h2>
            <p>
              Não compartilhamos dados pessoais ou tokens Google com terceiros,
              parceiros ou serviços de publicidade. Os dados são utilizados
              exclusivamente para as funcionalidades internas da plataforma.
            </p>
          </section>

          <section>
            <h2>5. Retenção e exclusão</h2>
            <p>
              Os tokens Google são removidos quando o usuário desconecta a conta Google
              nas configurações da plataforma. Ao desconectar, o acesso é revogado
              automaticamente junto ao Google.
            </p>
          </section>

          <section>
            <h2>6. Seus direitos</h2>
            <ul>
              <li>
                <strong>Revogar o acesso ao Google</strong> diretamente em{" "}
                <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer">
                  myaccount.google.com/permissions
                </a>.
              </li>
              <li><strong>Desconectar a conta Google</strong> pela opção disponível nas configurações da plataforma.</li>
              <li><strong>Solicitar exclusão dos seus dados</strong> entrando em contato com o administrador do escritório.</li>
            </ul>
          </section>

          <section>
            <h2>7. Segurança</h2>
            <p>
              A plataforma trafega exclusivamente via HTTPS. Sessões são protegidas por
              cookies seguros (<code>SameSite=None; Secure</code>). Tokens Google são
              cifrados em repouso. Acesso é restrito a usuários previamente cadastrados
              pelo administrador.
            </p>
          </section>

          <section>
            <h2>8. Contato</h2>
            <p>
              Dúvidas sobre esta política ou sobre o tratamento dos seus dados: entre em
              contato com o administrador do escritório responsável pela plataforma.
            </p>
          </section>

          <section>
            <h2>9. Alterações</h2>
            <p>
              Atualizações a esta política serão publicadas nesta página com a data de
              revisão atualizada.
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
