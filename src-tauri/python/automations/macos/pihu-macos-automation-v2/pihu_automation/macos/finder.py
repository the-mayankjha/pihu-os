from .applescript import run, quote

class FinderController:
    def open(self, path):
        return run(f'tell application "Finder" to open POSIX file "{quote(path)}"')
