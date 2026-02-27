from pydantic_settings import BaseSettings

GROBID_INSTANCES = [
    {
        "id": "self-hosted",
        "name": "Self-hosted (Tailscale)",
        "url": "http://localhost:8070",
        "description": "Self-hosted GROBID on Mac Studio via Tailscale. Most reliable.",
    },
    {
        "id": "hf-dl",
        "name": "HuggingFace (Deep Learning)",
        "url": "https://kermitt2-grobid.hf.space",
        "description": "Best accuracy, DL+CRF models. Free community instance.",
    },
    {
        "id": "hf-crf",
        "name": "HuggingFace (CRF-only)",
        "url": "https://kermitt2-grobid-crf.hf.space",
        "description": "Faster but lower accuracy. Free community instance.",
    },
    {
        "id": "science-miner",
        "name": "Science-Miner (Legacy)",
        "url": "https://cloud.science-miner.com/grobid",
        "description": "Official legacy instance. Often unstable.",
    },
    {
        "id": "lfoppiano",
        "name": "HuggingFace (lfoppiano)",
        "url": "https://lfoppiano-grobid.hf.space",
        "description": "Community instance. Availability may vary.",
    },
    {
        "id": "qingxu98",
        "name": "HuggingFace (qingxu98)",
        "url": "https://qingxu98-grobid.hf.space",
        "description": "Community instance. Availability may vary.",
    },
    {
        "id": "local",
        "name": "Local Docker (dev)",
        "url": "http://localhost:8070",
        "description": "Local Docker for development. Same as self-hosted in production.",
    },
]


class Settings(BaseSettings):
    grobid_url: str = GROBID_INSTANCES[0]["url"]
    grobid_verify_ssl: bool = True
    crossref_mailto: str = "refbib-app@proton.me"
    frontend_url: str = "http://localhost:3000"
    app_env: str = "development"
    site_password: str = ""

    # Rate limits (requests per second)
    crossref_rps: float = 10.0
    semantic_scholar_rps: float = 1.0
    dblp_rps: float = 3.0

    # Concurrency
    max_concurrent_lookups: int = 10

    # Matching
    fuzzy_match_threshold: float = 0.7
    exact_match_threshold: float = 0.9

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
