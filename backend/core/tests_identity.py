from django.contrib.auth.models import AnonymousUser, User
from django.test import RequestFactory, TestCase

from core.identity import current_usuario, is_admin
from usuarios.models import Usuario


class CurrentUsuarioTests(TestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create(
            nome="Ana", email="ana@example.com", cargo="Advogado"
        )

    def _request(self, user=None, session=None):
        request = RequestFactory().get("/")
        request.user = user or AnonymousUser()
        request.session = session or {}
        return request

    def test_session_id_wins(self):
        request = self._request(session={"usuario_id": self.usuario.pk})
        self.assertEqual(current_usuario(request), self.usuario)

    def test_email_match_is_case_insensitive(self):
        user = User.objects.create_user("x", email="ANA@Example.com")
        self.assertEqual(current_usuario(self._request(user)), self.usuario)

    def test_falls_back_to_username_when_email_does_not_match(self):
        user = User.objects.create_user("ana@example.com", email="other@example.com")
        self.assertEqual(current_usuario(self._request(user)), self.usuario)

    def test_anonymous_and_unknown_return_none(self):
        self.assertIsNone(current_usuario(self._request()))
        user = User.objects.create_user("nobody", email="nobody@example.com")
        self.assertIsNone(current_usuario(self._request(user)))


class IsAdminTests(TestCase):
    def test_staff_cargo_and_regular(self):
        staff = User.objects.create_user("s", is_staff=True)
        regular = User.objects.create_user("r")
        admin = Usuario(nome="A", email="a@x.com", cargo="Administrador")
        request = RequestFactory().get("/")
        request.user = staff
        self.assertTrue(is_admin(request))
        request.user = regular
        self.assertFalse(is_admin(request))
        self.assertTrue(is_admin(request, admin))
