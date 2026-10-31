import re

from app.core.config import Settings


def test_origin_list_parsing() -> None:
    s = Settings(cors_origins="https://a.vercel.app, http://localhost:5173 ,")
    assert s.cors_origin_list == ["https://a.vercel.app", "http://localhost:5173"]


def test_default_regex_allows_lan_dev_but_not_internet() -> None:
    pattern = Settings().cors_origin_regex
    assert re.fullmatch(pattern, "http://192.168.1.20:5173")
    assert not re.fullmatch(pattern, "https://evil.example.com")
    assert not re.fullmatch(pattern, "http://192.168.1.20:9999")
