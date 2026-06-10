from unittest.mock import MagicMock

from django.test import SimpleTestCase
from googleapiclient.errors import HttpError

from integrations.google import drive
from integrations.google.exceptions import GoogleApiError


def _resp(status):
    resp = MagicMock()
    resp.status = status
    return resp


def _http_error(status):
    return HttpError(_resp(status), b"{}")


class FakeRequest:
    """Mimics a googleapiclient request: chainable, returns canned data on execute."""

    def __init__(self, result=None, error=None):
        self._result = result if result is not None else {}
        self._error = error

    def execute(self):
        if self._error is not None:
            raise self._error
        return self._result


class FindFolderTests(SimpleTestCase):
    def test_returns_id_when_folder_exists(self):
        service = MagicMock()
        service.files().list.return_value = FakeRequest(
            {"files": [{"id": "folder-123", "name": "Clientes"}]}
        )
        self.assertEqual(drive.find_folder(service, "Clientes", "root-1"), "folder-123")

    def test_returns_none_when_absent(self):
        service = MagicMock()
        service.files().list.return_value = FakeRequest({"files": []})
        self.assertIsNone(drive.find_folder(service, "Nada", "root-1"))

    def test_escapes_single_quote_in_name(self):
        service = MagicMock()
        service.files().list.return_value = FakeRequest({"files": []})
        drive.find_folder(service, "O'Brien", "root-1")
        sent_query = service.files().list.call_args.kwargs["q"]
        self.assertIn("O\\'Brien", sent_query)


class EnsureFolderTests(SimpleTestCase):
    def test_reuses_existing_folder_without_creating(self):
        service = MagicMock()
        service.files().list.return_value = FakeRequest(
            {"files": [{"id": "existing", "name": "Petições"}]}
        )
        result = drive.ensure_folder(service, "Petições", "client-1")
        self.assertEqual(result, "existing")
        service.files().create.assert_not_called()

    def test_creates_folder_when_missing(self):
        service = MagicMock()
        service.files().list.return_value = FakeRequest({"files": []})
        service.files().create.return_value = FakeRequest(
            {"id": "new-folder", "name": "Petições"}
        )
        result = drive.ensure_folder(service, "Petições", "client-1")
        self.assertEqual(result, "new-folder")
        service.files().create.assert_called_once()


class UploadAndUpdateTests(SimpleTestCase):
    def test_upload_file_returns_metadata(self):
        service = MagicMock()
        service.files().create.return_value = FakeRequest(
            {"id": "file-1", "name": "rg.pdf", "webViewLink": "http://x"}
        )
        meta = drive.upload_file(
            service, "rg.pdf", "doc-folder", b"bytes", "application/pdf"
        )
        self.assertEqual(meta["id"], "file-1")
        self.assertEqual(meta["name"], "rg.pdf")

    def test_update_file_targets_existing_id(self):
        service = MagicMock()
        service.files().update.return_value = FakeRequest(
            {"id": "file-1", "name": "rg.pdf"}
        )
        meta = drive.update_file(service, "file-1", b"new", "application/pdf")
        self.assertEqual(meta["id"], "file-1")
        self.assertEqual(service.files().update.call_args.kwargs["fileId"], "file-1")


class ListFilesTests(SimpleTestCase):
    def test_aggregates_paginated_results(self):
        service = MagicMock()
        service.files().list.side_effect = [
            FakeRequest({"files": [{"id": "a"}], "nextPageToken": "p2"}),
            FakeRequest({"files": [{"id": "b"}]}),
        ]
        files = drive.list_files(service, "folder-1")
        self.assertEqual([f["id"] for f in files], ["a", "b"])


class ErrorHandlingTests(SimpleTestCase):
    def test_non_retryable_http_error_becomes_google_api_error(self):
        service = MagicMock()
        service.files().list.return_value = FakeRequest(error=_http_error(404))
        with self.assertRaises(GoogleApiError):
            drive.find_folder(service, "X", "root-1")

    def test_retryable_then_success(self):
        service = MagicMock()
        service.files().list.side_effect = [
            FakeRequest(error=_http_error(503)),
            FakeRequest({"files": [{"id": "ok"}]}),
        ]
        # ensure_folder -> find_folder retries internally and then succeeds
        self.assertEqual(drive.find_folder(service, "X", "root-1"), "ok")

    def test_retry_exhausted_raises(self):
        service = MagicMock()
        service.files().list.side_effect = [
            FakeRequest(error=_http_error(503)),
            FakeRequest(error=_http_error(503)),
            FakeRequest(error=_http_error(503)),
        ]
        with self.assertRaises(GoogleApiError):
            drive.find_folder(service, "X", "root-1")
