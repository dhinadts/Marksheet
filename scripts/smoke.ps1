$ErrorActionPreference = 'Stop'
docker compose up -d --build
docker compose ps
$backend = Invoke-WebRequest -UseBasicParsing http://localhost:3001/
$ai = Invoke-WebRequest -UseBasicParsing http://localhost:8000/health
$frontend = Invoke-WebRequest -UseBasicParsing http://localhost:3000/
if ($backend.StatusCode -ne 200 -or $ai.StatusCode -ne 200 -or $frontend.StatusCode -ne 200) { throw 'Smoke test failed' }
Write-Host 'AI-MARKS Docker smoke test passed.'
