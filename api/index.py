import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'jurisagenda.settings')

from jurisagenda.wsgi import application

app = application
