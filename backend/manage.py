#!/usr/bin/env python
"""Utilitário de linha de comando do Django para tarefas administrativas."""
import os
import sys


def main():
    """Executa tarefas administrativas."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jurisagenda.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Não foi possível importar o Django. Verifique se ele está instalado, "
            "disponível na variável de ambiente PYTHONPATH e se o ambiente virtual "
            "foi ativado."
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
