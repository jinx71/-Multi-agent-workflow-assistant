"""Application configuration.

All settings are read from environment variables (or a local ``.env`` file).
Secrets are never hardcoded — see ``.env.example`` for the full list.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Credentials -------------------------------------------------------
    groq_api_key: str = ""
    tavily_api_key: str = ""

    # --- Model selection ---------------------------------------------------
    # One Groq model serves every agent role. Override it in a single place via
    # the GROQ_MODEL env var (e.g. "openai/gpt-oss-120b").
    groq_model: str = "llama-3.3-70b-versatile"

    # --- Workflow tuning ---------------------------------------------------
    max_revisions: int = 2          # critic->summarizer feedback loops allowed
    max_research_tool_calls: int = 4  # cap on search rounds inside researcher
    search_results_per_query: int = 4
    request_timeout_seconds: int = 120

    # --- Server ------------------------------------------------------------
    cors_origins: str = "http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def search_enabled(self) -> bool:
        return bool(self.tavily_api_key)

    # Per-role model accessors — all resolve to the single configured model, so
    # the nodes and the /api/config endpoint stay role-aware without needing
    # separate settings.
    @property
    def researcher_model(self) -> str:
        return self.groq_model

    @property
    def summarizer_model(self) -> str:
        return self.groq_model

    @property
    def critic_model(self) -> str:
        return self.groq_model


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor (constructed once per process)."""
    return Settings()
