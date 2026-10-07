from dataclasses import dataclass
from typing import Callable, Any


@dataclass
class Action:
    name: str
    execute: Callable[..., Any]
    description: str = ""


class AutomationEngine:
    def __init__(self) -> None:
        self._actions: dict[str, Action] = {}

    def register(self, action: Action) -> None:
        self._actions[action.name] = action

    def run(self, name: str, **kwargs: Any) -> Any:
        if name not in self._actions:
            raise KeyError(f"Unknown automation action: {name}")
        return self._actions[name].execute(**kwargs)

    def list_actions(self) -> list[Action]:
        return list(self._actions.values())
