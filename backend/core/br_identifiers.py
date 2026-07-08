"""Brazilian identifier extraction and validation helpers.

Pure functions, no Django/DB dependency, so they're reusable both by form
validation (CPF/CNPJ, ``numero_processo``) and by the Drive import heuristics
(``documentos.importacao``), which scan file/folder names for hints of a CNJ
process number or a CPF/CNPJ to suggest a classification.
"""

from __future__ import annotations

import re

CNJ_DIGITS_RE = re.compile(r"\d{20}")
CNJ_FORMATTED_RE = re.compile(r"\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}")

CPF_DIGITS_RE = re.compile(r"\d{11}")
CNPJ_DIGITS_RE = re.compile(r"\d{14}")

PALAVRAS_PROCESSO = {
    "processo",
    "acao",
    "ação",
    "autos",
    "peticao",
    "petição",
    "recurso",
    "sentenca",
    "sentença",
    "audiencia",
    "audiência",
    "citacao",
    "citação",
    "contestacao",
    "contestação",
    "vara",
    "tribunal",
    "juizo",
    "juízo",
}

PALAVRAS_PESSOAL = {
    "rg",
    "cnh",
    "identidade",
    "certidao",
    "certidão",
    "comprovante",
    "residencia",
    "residência",
    "contrato",
    "procuracao",
    "procuração",
    "passaporte",
    "titulo",
    "título",
    "carteira",
}


def _somente_digitos(texto: str) -> str:
    return re.sub(r"\D", "", texto or "")


def validar_cnj(numero: str) -> bool:
    """Validate a CNJ process number (format NNNNNNN-DD.AAAA.J.TR.OOOO).

    Implements the CNJ Resolução 65/2008 check-digit algorithm (mod 97-10).
    Accepts either the formatted string or 20 bare digits.
    """
    digitos = _somente_digitos(numero)
    if len(digitos) != 20:
        return False

    sequencial = digitos[0:7]
    dv_informado = digitos[7:9]
    ano = digitos[9:13]
    segmento = digitos[13:14]
    tribunal = digitos[14:16]
    orgao = digitos[16:20]

    base = int(sequencial + ano + segmento + tribunal + orgao + "00")
    resto = base % 97
    dv_calculado = 98 - resto
    return f"{dv_calculado:02d}" == dv_informado


def extrair_cnj(texto: str) -> list[str]:
    """Return CNJ numbers found in ``texto`` (formatted or bare digits) that pass validation."""
    encontrados: list[str] = []
    for match in CNJ_FORMATTED_RE.findall(texto or ""):
        if validar_cnj(match) and match not in encontrados:
            encontrados.append(match)
    for match in CNJ_DIGITS_RE.findall(texto or ""):
        if validar_cnj(match) and match not in encontrados:
            encontrados.append(match)
    return encontrados


def validar_cpf(cpf: str) -> bool:
    """Validate a CPF via its two check digits."""
    digitos = _somente_digitos(cpf)
    if len(digitos) != 11 or digitos == digitos[0] * 11:
        return False

    for posicao in (9, 10):
        soma = sum(
            int(digitos[indice]) * ((posicao + 1) - indice) for indice in range(posicao)
        )
        digito_calculado = ((soma * 10) % 11) % 10
        if digito_calculado != int(digitos[posicao]):
            return False
    return True


def validar_cnpj(cnpj: str) -> bool:
    """Validate a CNPJ via its two check digits."""
    digitos = _somente_digitos(cnpj)
    if len(digitos) != 14 or digitos == digitos[0] * 14:
        return False

    pesos_dv1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos_dv2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

    def calcular_dv(base: str, pesos: list[int]) -> str:
        soma = sum(int(digito) * peso for digito, peso in zip(base, pesos))
        resto = soma % 11
        return "0" if resto < 2 else str(11 - resto)

    dv1 = calcular_dv(digitos[:12], pesos_dv1)
    if dv1 != digitos[12]:
        return False
    dv2 = calcular_dv(digitos[:12] + dv1, pesos_dv2)
    return dv2 == digitos[13]


def validar_cpf_cnpj(valor: str) -> bool:
    """Validate ``valor`` as either a CPF (11 digits) or CNPJ (14 digits)."""
    digitos = _somente_digitos(valor)
    if len(digitos) == 11:
        return validar_cpf(digitos)
    if len(digitos) == 14:
        return validar_cnpj(digitos)
    return False


def extrair_cpf_cnpj(texto: str) -> list[str]:
    """Return CPF/CNPJ digit strings found in ``texto`` that pass validation."""
    encontrados: list[str] = []
    for match in CNPJ_DIGITS_RE.findall(texto or ""):
        if validar_cnpj(match) and match not in encontrados:
            encontrados.append(match)
    for match in CPF_DIGITS_RE.findall(texto or ""):
        if validar_cpf(match) and match not in encontrados:
            encontrados.append(match)
    return encontrados


def classificar_por_palavras(texto: str) -> str | None:
    """Guess ``"processo"`` vs ``"pessoal"`` from keywords in a file/folder name.

    Returns ``None`` when no keyword matches either side; callers should treat
    that as "no suggestion" rather than a default category.
    """
    normalizado = (texto or "").lower()
    tem_processo = any(palavra in normalizado for palavra in PALAVRAS_PROCESSO)
    tem_pessoal = any(palavra in normalizado for palavra in PALAVRAS_PESSOAL)

    if tem_processo and not tem_pessoal:
        return "processo"
    if tem_pessoal and not tem_processo:
        return "pessoal"
    return None
