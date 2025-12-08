"""Configuration management for Sprut.hub MCP server."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    spruthub_ws_url: str = Field(
        ...,
        description="WebSocket URL for Sprut.hub connection (e.g., wss://web.spruthub.ru/spruthub)",
    )
    spruthub_email: str = Field(
        ...,
        description="Email address for Sprut.hub authentication",
    )
    spruthub_password: str = Field(
        ...,
        description="Password for Sprut.hub authentication",
    )
    spruthub_serial: str = Field(
        ...,
        description="Serial number of Sprut.hub device",
    )
    log_level: str = Field(
        default="info",
        description="Logging level (debug, info, warn, error)",
    )
    host: str = Field(
        default="127.0.0.1",
        description="Host to bind HTTP server to",
    )
    port: int = Field(
        default=9084,
        description="Port to bind HTTP server to",
    )


# Global settings instance
settings = Settings()
