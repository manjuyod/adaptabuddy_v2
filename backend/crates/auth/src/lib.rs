use axum::http::{header, HeaderMap};
use core_domain::UserId;
use jsonwebtoken::{
    decode, decode_header,
    jwk::{Jwk, JwkSet},
    Algorithm, DecodingKey, Validation,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use thiserror::Error;
use uuid::Uuid;

const LOCAL_DEV_TOKEN: &str = "local-dev-token";
const LOCAL_DEV_USER_ID: &str = "00000000-0000-0000-0000-000000000001";
const JWKS_CACHE_TTL: Duration = Duration::from_secs(60 * 5);

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub supabase_jwks_url: Option<String>,
    pub local_jwt_secret: Option<String>,
    pub allow_local_dev_token: bool,
    jwks_cache: Arc<Mutex<Option<CachedJwks>>>,
}

#[derive(Clone, Debug)]
struct CachedJwks {
    fetched_at: Instant,
    set: JwkSet,
}

impl AuthConfig {
    pub fn from_env() -> Self {
        let supabase_url = std::env::var("SUPABASE_URL").ok();
        Self::new(
            supabase_url.map(|url| {
                format!(
                    "{}/auth/v1/.well-known/jwks.json",
                    url.trim_end_matches('/')
                )
            }),
            std::env::var("SUPABASE_JWT_SECRET").ok(),
            std::env::var("ALLOW_LOCAL_DEV_TOKEN")
                .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
                .unwrap_or(false),
        )
    }

    pub fn new(
        supabase_jwks_url: Option<String>,
        local_jwt_secret: Option<String>,
        allow_local_dev_token: bool,
    ) -> Self {
        Self {
            supabase_jwks_url,
            local_jwt_secret,
            allow_local_dev_token,
            jwks_cache: Arc::new(Mutex::new(None)),
        }
    }

    pub fn local_dev() -> Self {
        Self::new(None, None, true)
    }

    pub fn with_local_jwt_secret(secret: impl Into<String>) -> Self {
        Self::new(None, Some(secret.into()), false)
    }
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self::from_env()
    }
}

#[derive(Clone, Debug, Serialize)]
pub struct AuthenticatedUser {
    pub user_id: UserId,
    pub provider: String,
    pub role: String,
    pub session_id: Option<Uuid>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RouteClass {
    Public,
    User,
    Internal,
    Webhook,
}

#[derive(Clone, Debug, Serialize)]
pub struct AuthContext {
    pub user_id: UserId,
    pub provider: String,
    pub route_class: RouteClass,
    pub role: String,
    pub session_id: Option<Uuid>,
}

impl AuthContext {
    pub fn new(user: AuthenticatedUser, route_class: RouteClass) -> Self {
        Self {
            user_id: user.user_id,
            provider: user.provider,
            route_class,
            role: user.role,
            session_id: user.session_id,
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
struct SupabaseClaims {
    sub: String,
    exp: usize,
    #[serde(default)]
    role: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
}

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("missing session token")]
    MissingToken,
    #[error("invalid session token")]
    InvalidToken,
}

pub async fn authenticate(
    headers: &HeaderMap,
    config: &AuthConfig,
) -> Result<AuthenticatedUser, AuthError> {
    let token = bearer_token(headers)
        .or_else(|| session_cookie(headers))
        .ok_or(AuthError::MissingToken)?;

    if config.allow_local_dev_token && token == LOCAL_DEV_TOKEN {
        let user_id = Uuid::parse_str(LOCAL_DEV_USER_ID).map_err(|_| AuthError::InvalidToken)?;
        return Ok(AuthenticatedUser {
            user_id: UserId(user_id),
            provider: "local-dev".to_string(),
            role: "authenticated".to_string(),
            session_id: None,
        });
    }

    if let Some(user) = decode_with_configured_secret(token, config)? {
        return Ok(user);
    }

    if let Some(user) = decode_with_jwks(token, config).await? {
        return Ok(user);
    }

    Err(AuthError::InvalidToken)
}

fn bearer_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
}

fn session_cookie(headers: &HeaderMap) -> Option<&str> {
    let cookie = headers.get(header::COOKIE)?.to_str().ok()?;
    cookie
        .split(';')
        .map(str::trim)
        .find_map(|entry| entry.strip_prefix("sb-access-token="))
}

fn decode_with_configured_secret(
    token: &str,
    config: &AuthConfig,
) -> Result<Option<AuthenticatedUser>, AuthError> {
    let Some(secret) = config.local_jwt_secret.as_ref() else {
        return Ok(None);
    };
    if secret.trim().is_empty() {
        return Ok(None);
    }

    let header = decode_header(token).map_err(|_| AuthError::InvalidToken)?;
    if header.alg != Algorithm::HS256 {
        return Ok(None);
    }

    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&["authenticated"]);
    validation.set_required_spec_claims(&["exp", "sub", "aud"]);
    validation.validate_nbf = true;
    let claims = decode::<SupabaseClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map_err(|_| AuthError::InvalidToken)?;

    claims_to_user(claims.claims).map(Some)
}

async fn decode_with_jwks(
    token: &str,
    config: &AuthConfig,
) -> Result<Option<AuthenticatedUser>, AuthError> {
    let Some(jwks_url) = config.supabase_jwks_url.as_ref() else {
        return Ok(None);
    };

    let header = decode_header(token).map_err(|_| AuthError::InvalidToken)?;
    let kid = header.kid.ok_or(AuthError::InvalidToken)?;
    let jwks = cached_or_fetch_jwks(config, jwks_url).await?;
    let jwk = jwks
        .keys
        .iter()
        .find(|candidate| jwk_key_id(candidate) == Some(kid.as_str()))
        .ok_or(AuthError::InvalidToken)?;

    let mut validation = Validation::new(header.alg);
    validation.set_audience(&["authenticated"]);
    validation.set_required_spec_claims(&["exp", "sub", "aud"]);
    validation.validate_nbf = true;
    let key = DecodingKey::from_jwk(jwk).map_err(|_| AuthError::InvalidToken)?;
    let claims =
        decode::<SupabaseClaims>(token, &key, &validation).map_err(|_| AuthError::InvalidToken)?;

    claims_to_user(claims.claims).map(Some)
}

fn claims_to_user(claims: SupabaseClaims) -> Result<AuthenticatedUser, AuthError> {
    let _ = claims.exp;
    let role = claims
        .role
        .filter(|role| role == "authenticated")
        .ok_or(AuthError::InvalidToken)?;
    let user_id = Uuid::parse_str(&claims.sub)
        .ok()
        .map(UserId)
        .ok_or(AuthError::InvalidToken)?;
    let session_id = claims
        .session_id
        .as_deref()
        .map(Uuid::parse_str)
        .transpose()
        .map_err(|_| AuthError::InvalidToken)?;

    Ok(AuthenticatedUser {
        user_id,
        provider: "supabase".to_string(),
        role,
        session_id,
    })
}

async fn cached_or_fetch_jwks(config: &AuthConfig, jwks_url: &str) -> Result<JwkSet, AuthError> {
    if let Some(cached) = config
        .jwks_cache
        .lock()
        .map_err(|_| AuthError::InvalidToken)?
        .clone()
    {
        if cached.fetched_at.elapsed() < JWKS_CACHE_TTL {
            return Ok(cached.set);
        }
    }

    let set = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|_| AuthError::InvalidToken)?
        .get(jwks_url)
        .send()
        .await
        .map_err(|_| AuthError::InvalidToken)?
        .error_for_status()
        .map_err(|_| AuthError::InvalidToken)?
        .json::<JwkSet>()
        .await
        .map_err(|_| AuthError::InvalidToken)?;

    *config
        .jwks_cache
        .lock()
        .map_err(|_| AuthError::InvalidToken)? = Some(CachedJwks {
        fetched_at: Instant::now(),
        set: set.clone(),
    });

    Ok(set)
}

fn jwk_key_id(jwk: &Jwk) -> Option<&str> {
    jwk.common.key_id.as_deref()
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{encode, EncodingKey, Header};

    #[derive(Serialize)]
    struct TestClaims {
        sub: String,
        exp: usize,
        aud: String,
        role: String,
        session_id: String,
    }

    #[test]
    fn local_supabase_jwt_claims_include_role_and_session_id() {
        let secret = "local-test-secret";
        let user_id = Uuid::new_v4();
        let session_id = Uuid::new_v4();
        let token = encode(
            &Header::new(Algorithm::HS256),
            &TestClaims {
                sub: user_id.to_string(),
                exp: 4_102_444_800,
                aud: "authenticated".to_string(),
                role: "authenticated".to_string(),
                session_id: session_id.to_string(),
            },
            &EncodingKey::from_secret(secret.as_bytes()),
        )
        .expect("test token should sign");

        let user =
            decode_with_configured_secret(&token, &AuthConfig::with_local_jwt_secret(secret))
                .expect("token should decode")
                .expect("token should produce a user");

        assert_eq!(user.user_id.0, user_id);
        assert_eq!(user.role, "authenticated");
        assert_eq!(user.session_id, Some(session_id));
    }

    #[test]
    fn non_hs256_token_skips_local_secret_decode() {
        let token = concat!(
            "eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3Qta2V5IiwidHlwIjoiSldUIn0",
            ".",
            "eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJleHAiOjQxMDI0NDQ4MDAsInJvbGUiOiJhdXRoZW50aWNhdGVkIn0",
            ".",
            "signature",
        );

        let user = decode_with_configured_secret(
            token,
            &AuthConfig::with_local_jwt_secret("local-test-secret"),
        )
        .expect("non-HS256 tokens should be handled by later auth strategies");

        assert!(user.is_none());
    }
}
