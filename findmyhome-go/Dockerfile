# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Cache module downloads separately from source
COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Build a fully static binary (no CGO needed for pgx pure-Go driver)
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /findmyhome-api ./cmd/server

# ── Stage 2: run ──────────────────────────────────────────────────────────────
FROM gcr.io/distroless/static:nonroot

COPY --from=builder /findmyhome-api /findmyhome-api

EXPOSE 8000

ENTRYPOINT ["/findmyhome-api"]
