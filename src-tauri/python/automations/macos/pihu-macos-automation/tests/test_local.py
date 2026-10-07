"""Non-destructive smoke tests. Run on macOS only."""
from pihu_automation.macos.applications import is_running


def test_system_events_available():
    # Finder is normally available; this only checks that osascript can execute.
    assert isinstance(is_running("Finder"), bool)
