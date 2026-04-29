use dotenvy::dotenv;
use ethoko_central::httpserver::serve_http_server;
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;
use tracing::{info, level_filters::LevelFilter};
use tracing_subscriber::{Layer, layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), anyhow::Error> {
    if let Err(err) = dotenv()
        && !err.not_found()
    {
        return Err(anyhow::Error::new(err).context("Error while loading .env file"));
    }

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::fmt::layer()
                .with_filter(Into::<LevelFilter>::into(LevelFilter::TRACE)),
        )
        .init();

    let pool = match PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect("postgresql://admin:admin@localhost:5432/central")
        .await
    {
        Ok(c) => c,
        Err(e) => {
            return Err(anyhow::Error::new(e).context("Failed to establish connection to database"));
        }
    };

    if let Err(e) = sqlx::migrate!("./migrations").run(&pool).await {
        return Err(anyhow::Error::new(e).context("Failed to run database migrations"));
    };

    info!("Successfully ran migrations");

    let addr = format!("0.0.0.0:{}", 3000);
    let listener = tokio::net::TcpListener::bind(&addr).await.map_err(|err| {
        anyhow::Error::new(err).context(format!(
            "Error while binding the TCP listener to address {addr}"
        ))
    })?;

    info!(
        "Successfully bind the TCP listener to address {}\n",
        listener.local_addr().unwrap()
    );

    serve_http_server(listener).await
}
