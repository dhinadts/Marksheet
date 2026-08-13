from fastapi import FastAPI

app = FastAPI(
    title="AI-MARKS AI Service",
    description="Image-processing and inference boundary for AI-MARKS.",
    version="0.1.0",
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    """Return service readiness without loading an inference model."""
    return {"status": "ok", "service": "ai-service"}

