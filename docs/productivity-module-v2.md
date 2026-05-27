# Modulo de produtividade v2

## O que mudou

- Criado o app Django `productivity` para separar timers e metas do restante do CRM.
- Adicionadas as tabelas `time_entries` e `productivity_goals`, com tempos sempre salvos em segundos.
- Incluidos endpoints para iniciar, pausar, retomar e encerrar timers, mantendo um timer `running` por usuario.
- Incluidos endpoints de metas para admin configurar meta global ou por usuario.
- O bootstrap inicial agora entrega `time_entries` e `productivity_goals` quando o usuario tem permissao.
- O frontend recebeu um componente unico de timer para cards de peticao, contestacao e prazo.
- O perfil do usuario recebeu a secao "Produtividade" com metricas, timers ativos, historico e tempo por processo.
- Admin recebeu a tela "Produtividade do escritorio" com ranking, progresso contra metas, painel individual somente leitura e configuracao de metas.

## Por que

- Timers de peticoes, contestacoes e prazos usam a mesma regra de tempo, entao ficaram em um componente e em uma API compartilhados.
- Metas ficam separadas de usuarios para permitir padrao global e sobrescrita por pessoa sem alterar o cadastro principal.
- Dados de escritorio ficam restritos ao admin; usuario comum recebe apenas os proprios registros.
