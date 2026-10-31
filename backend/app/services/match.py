"""Owner: AI/matching. Exact/fuzzy first, Qwen only for ambiguous candidate selection."""

from app.schemas.domain import CatalogItem, LineItem, Match, ModelMatchResult


def match_by_rules(item: LineItem, catalog: list[CatalogItem]) -> Match | None:
    """Exact normalised / RapidFuzz match. Return None when not confident (-> model or review)."""
    raise NotImplementedError


async def select_candidate_with_model(
    item: LineItem, candidates: list[CatalogItem]
) -> ModelMatchResult:
    """Ask the model to pick one of `candidates` (via services.ollama.chat). Validate the JSON;
    reject IDs not in `candidates`; raise ollama.OllamaError on outage."""
    raise NotImplementedError


async def match_line(item: LineItem, catalog: list[CatalogItem]) -> Match:
    """Full pipeline. On model failure return status=needs_review; never fabricate a match."""
    raise NotImplementedError
