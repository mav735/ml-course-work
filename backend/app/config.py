from pydantic_settings import BaseSettings, SettingsConfigDict


LABELS: list[str] = [
    "apple",
    "carrot",
    "star",
    "house",
    "tree",
    "fish",
    "sun",
    "flower",
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/drawings"
    cors_origins: str = "*"
    moderation_secret_key: str = "change-me"


settings = Settings()
