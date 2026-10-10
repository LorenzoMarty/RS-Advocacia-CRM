from unittest.mock import MagicMock, patch

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


class FolderAndFileOpsTests(SimpleTestCase):
    def test_create_google_doc_sends_doc_mime_and_html_media(self):
        service = MagicMock()
        service.files().create.return_value = FakeRequest({"id": "doc-1"})
        result = drive.create_google_doc(service, "Minuta", "parent", "<p>oi</p>")
        self.assertEqual(result["id"], "doc-1")
        body = service.files().create.call_args.kwargs["body"]
        self.assertEqual(body["mimeType"], drive.GOOGLE_DOC_MIME_TYPE)
        self.assertEqual(body["parents"], ["parent"])

    def test_rename_file_sends_new_name(self):
        service = MagicMock()
        service.files().update.return_value = FakeRequest({"id": "f1", "name": "Novo"})
        drive.rename_file(service, "f1", "Novo")
        kwargs = service.files().update.call_args.kwargs
        self.assertEqual((kwargs["fileId"], kwargs["body"]), ("f1", {"name": "Novo"}))

    def test_move_file_swaps_parents(self):
        service = MagicMock()
        service.files().update.return_value = FakeRequest({"id": "f1"})
        drive.move_file(service, "f1", "novo-pai", "velho-pai")
        kwargs = service.files().update.call_args.kwargs
        self.assertEqual(kwargs["addParents"], "novo-pai")
        self.assertEqual(kwargs["removeParents"], "velho-pai")

    def test_get_file_returns_metadata(self):
        service = MagicMock()
        service.files().get.return_value = FakeRequest({"id": "f1", "name": "a"})
        self.assertEqual(drive.get_file(service, "f1")["name"], "a")

    def test_list_folders_follows_pagination(self):
        service = MagicMock()
        service.files().list.side_effect = [
            FakeRequest({"files": [{"id": "1"}], "nextPageToken": "t2"}),
            FakeRequest({"files": [{"id": "2"}]}),
        ]
        self.assertEqual([f["id"] for f in drive.list_folders(service, "p")], ["1", "2"])
        tokens = [c.kwargs["pageToken"] for c in service.files().list.call_args_list]
        self.assertEqual(tokens, [None, "t2"])

    def test_list_queries_escape_parent_id(self):
        service = MagicMock()
        service.files().list.return_value = FakeRequest({"files": []})
        drive.list_files(service, "o'x")
        self.assertIn("o\\'x", service.files().list.call_args.kwargs["q"])


class DeleteTests(SimpleTestCase):
    def _delete_error(self, status):
        service = MagicMock()
        service.files().delete.return_value = FakeRequest(error=_http_error(status))
        return service

    def test_missing_item_counts_as_deleted(self):
        drive.delete_file(self._delete_error(404), "f1")
        drive.delete_folder(self._delete_error(404), "d1")

    def test_other_errors_propagate(self):
        with self.assertRaises(GoogleApiError):
            drive.delete_file(self._delete_error(403), "f1")
        with self.assertRaises(GoogleApiError):
            drive.delete_folder(self._delete_error(403), "d1")

    def test_success_calls_delete_once(self):
        service = MagicMock()
        service.files().delete.return_value = FakeRequest({})
        drive.delete_file(service, "f1")
        self.assertEqual(service.files().delete.call_args.kwargs["fileId"], "f1")


class ChangesFeedTests(SimpleTestCase):
    def test_start_page_token(self):
        service = MagicMock()
        service.changes().getStartPageToken.return_value = FakeRequest(
            {"startPageToken": "42"}
        )
        self.assertEqual(drive.get_start_page_token(service), "42")

    def test_list_changes_paginates_and_returns_final_cursor(self):
        service = MagicMock()
        service.changes().list.side_effect = [
            FakeRequest({"changes": [{"fileId": "a"}], "nextPageToken": "p2"}),
            FakeRequest({"changes": [{"fileId": "b"}], "newStartPageToken": "p9"}),
        ]
        result = drive.list_changes(service, "p1")
        self.assertEqual([c["fileId"] for c in result["changes"]], ["a", "b"])
        self.assertEqual(result["new_start_page_token"], "p9")
        tokens = [c.kwargs["pageToken"] for c in service.changes().list.call_args_list]
        self.assertEqual(tokens, ["p1", "p2"])

    def test_list_changes_keeps_cursor_when_nothing_new(self):
        service = MagicMock()
        service.changes().list.return_value = FakeRequest({"changes": []})
        result = drive.list_changes(service, "p1")
        self.assertEqual(result, {"changes": [], "new_start_page_token": "p1"})


class ResumableUploadAndDownloadTests(SimpleTestCase):
    def _session(self, status=200, location="https://upload/session"):
        response = MagicMock(status_code=status)
        response.headers = {"Location": location} if location else {}
        session = MagicMock()
        session.post.return_value = response
        return session

    @patch("integrations.google.drive.AuthorizedSession")
    def test_returns_session_uri_and_forwards_origin(self, mock_cls):
        mock_cls.return_value = self._session()
        url = drive.create_resumable_upload_session(
            MagicMock(),
            name="a.pdf",
            parent_id="p",
            mime_type="application/pdf",
            size_bytes=10,
            origin="https://app.example",
        )
        self.assertEqual(url, "https://upload/session")
        headers = mock_cls.return_value.post.call_args.kwargs["headers"]
        self.assertEqual(headers["Origin"], "https://app.example")
        self.assertEqual(headers["X-Upload-Content-Length"], "10")

    @patch("integrations.google.drive.AuthorizedSession")
    def test_bad_status_or_missing_location_raises(self, mock_cls):
        for session in (self._session(status=403), self._session(location="")):
            mock_cls.return_value = session
            with self.assertRaises(GoogleApiError):
                drive.create_resumable_upload_session(
                    MagicMock(),
                    name="a",
                    parent_id="p",
                    mime_type="",
                    size_bytes=1,
                    origin="",
                )

    @patch("integrations.google.drive.AuthorizedSession")
    def test_network_failure_becomes_google_api_error(self, mock_cls):
        mock_cls.return_value.post.side_effect = ConnectionError("down")
        with self.assertRaises(GoogleApiError):
            drive.create_resumable_upload_session(
                MagicMock(), name="a", parent_id="p", mime_type="", size_bytes=1, origin=""
            )

    @patch("integrations.google.drive.MediaIoBaseDownload")
    def test_download_reads_chunks_until_done(self, mock_download):
        def build(buffer, _request):
            downloader = MagicMock()

            def next_chunk():
                if buffer.tell() == 0:
                    buffer.write(b"abc")
                    return None, False
                buffer.write(b"def")
                return None, True

            downloader.next_chunk.side_effect = next_chunk
            return downloader

        mock_download.side_effect = build
        self.assertEqual(drive.download_file(MagicMock(), "f1"), b"abcdef")

    def test_download_http_error_becomes_google_api_error(self):
        service = MagicMock()
        service.files().get_media.side_effect = _http_error(404)
        with self.assertRaises(GoogleApiError):
            drive.download_file(service, "f1")
