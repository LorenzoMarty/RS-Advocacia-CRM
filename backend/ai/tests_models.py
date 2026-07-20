from django.core.exceptions import ImproperlyConfigured
from django.test import TestCase

from ai.models import ConfiguracaoIA, UsoIA, estimar_custo_usd
from ai.providers.openai_provider import OpenAIProvider


class ConfiguracaoIATests(TestCase):
    def test_api_key_e_criptografada_no_banco_e_decriptada_na_leitura(self):
        config = ConfiguracaoIA()
        config.set_api_key("sk-teste-123")
        config.save()

        salvo = ConfiguracaoIA.objects.get(pk=config.pk)

        self.assertNotIn("sk-teste-123", salvo.api_key_ciphertext)
        self.assertEqual(salvo.api_key, "sk-teste-123")

    def test_obter_api_key_ativa_retorna_vazio_sem_configuracao(self):
        self.assertEqual(ConfiguracaoIA.obter_api_key_ativa(), "")

    def test_obter_api_key_ativa_retorna_key_configurada(self):
        config = ConfiguracaoIA()
        config.set_api_key("sk-ativa")
        config.save()

        self.assertEqual(ConfiguracaoIA.obter_api_key_ativa(), "sk-ativa")


class OpenAIProviderApiKeyDoBancoTests(TestCase):
    def test_sem_key_cadastrada_recusa_instanciar_provider(self):
        with self.assertRaises(ImproperlyConfigured):
            OpenAIProvider()

    def test_com_key_cadastrada_instancia_provider_normalmente(self):
        config = ConfiguracaoIA()
        config.set_api_key("sk-banco-123")
        config.save()

        provider = OpenAIProvider()

        self.assertEqual(provider.client.api_key, "sk-banco-123")


class UsoIATests(TestCase):
    def test_custo_usd_usa_tabela_de_preco_por_modelo(self):
        uso = UsoIA.objects.create(
            operacao=UsoIA.OPERACAO_RESUMO,
            modelo="gpt-4.1-mini",
            tokens_entrada=1_000_000,
            tokens_saida=1_000_000,
        )

        self.assertAlmostEqual(uso.custo_usd, 0.40 + 1.60)

    def test_custo_usd_zero_para_modelo_desconhecido(self):
        self.assertEqual(estimar_custo_usd("modelo-inexistente", 1000, 1000), 0.0)
