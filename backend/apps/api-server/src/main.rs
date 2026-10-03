use api_server::{app, AppState};
use std::net::SocketAddr;
use storage::AppStore;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    match dotenvy::dotenv() {
        Ok(_) => {}
        Err(error) if error.not_found() => {}
        Err(_) => anyhow::bail!("Could not load .env; check its syntax and permissions"),
    }
    let bind_addr = std::env::var("API_BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:3000".to_string());
    let addr: SocketAddr = bind_addr.parse()?;
    let store = match std::env::var("DATABASE_URL") {
        Ok(database_url) if !database_url.trim().is_empty() => {
            let store = AppStore::connect(&database_url).await?;
            println!("Postgres storage enabled");
            store
        }
        _ => {
            eprintln!("DATABASE_URL is not configured: using in-memory storage; data will be lost on restart");
            AppStore::new()
        }
    };
    let state = AppState::new(store, auth::AuthConfig::from_env());
    let listener = tokio::net::TcpListener::bind(addr).await?;

    println!("api-server listening on http://{addr}");
    axum::serve(listener, app(state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
