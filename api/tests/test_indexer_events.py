from pathlib import Path

from watchdog.events import FileClosedNoWriteEvent, FileModifiedEvent, FileMovedEvent, FileOpenedEvent

from app.services.embeddings import EmbeddingsClient
from app.services.indexer import Indexer, _Handler


class Recorder(Indexer):
    def __init__(self) -> None:
        super().__init__(Path("/tmp"), None, EmbeddingsClient(provider="none"))
        self.seen: list[str] = []

    def notify_threadsafe(self, absolute_path: str) -> None:
        self.seen.append(absolute_path)


def test_reads_do_not_feed_the_queue() -> None:
    recorder = Recorder()
    handler = _Handler(recorder)
    handler.dispatch(FileOpenedEvent("/vault/a.md"))
    handler.dispatch(FileClosedNoWriteEvent("/vault/a.md"))
    assert recorder.seen == []


def test_writes_and_moves_are_queued() -> None:
    recorder = Recorder()
    handler = _Handler(recorder)
    handler.dispatch(FileModifiedEvent("/vault/a.md"))
    handler.dispatch(FileMovedEvent("/vault/a.md", "/vault/b.md"))
    assert recorder.seen == ["/vault/a.md", "/vault/a.md", "/vault/b.md"]
