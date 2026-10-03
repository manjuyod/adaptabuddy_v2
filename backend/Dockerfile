FROM rust:1-bookworm AS build

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY apps ./apps
COPY crates ./crates
RUN cargo build --release -p api-server

FROM debian:bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/target/release/api-server /usr/local/bin/api-server

ENV API_BIND_ADDR=0.0.0.0:3000
EXPOSE 3000

CMD ["api-server"]
