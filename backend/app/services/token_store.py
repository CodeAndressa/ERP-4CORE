"""Armazenamento persistente de tokens OAuth (complementa o .env, tem prioridade sobre ele)."""
from __future__ import annotations

import json
import os

_STORE_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '.meta_tokens.json')


def _load() -> dict:
    try:
        with open(_STORE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def get(key: str, default: str = '') -> str:
    return _load().get(key, default)


def save(data: dict) -> None:
    existing = _load()
    existing.update(data)
    with open(_STORE_PATH, 'w', encoding='utf-8') as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
