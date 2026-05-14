use crate::{
    newtypes::{email::EmailError, handle::HandleError, password::PasswordError},
    router::ApiError,
};
use axum::{Json, Router, http::StatusCode, routing::post};
use serde::{Deserialize, Serialize};

use super::models::{EmailSignupRequest, EmailSignupRequestError};

pub fn auth_router() -> Router {
    Router::new().route("/signup/email", post(handle_signup_email))
}

#[derive(Deserialize, Serialize)]
pub struct SignupEmailBody {
    pub email: String,
    pub handle: String,
    pub password: String,
}

async fn handle_signup_email(
    Json(body): Json<SignupEmailBody>,
) -> Result<(StatusCode, String), ApiError> {
    let request = match EmailSignupRequest::new(body.email, body.handle, body.password) {
        Ok(req) => req,
        Err(e) => {
            match e {
                EmailSignupRequestError::InvalidEmail(err) => {
                    let error_message = match err {
                        EmailError::Empty => "\"email\": empty value not allowed".to_string(),
                        EmailError::InvalidFormat => "\"email\": invalid format".to_string(),
                    };
                    return Err(ApiError::BadRequest(error_message));
                }
                EmailSignupRequestError::InvalidHandle(err) => {
                    let error_message = match err {
                        HandleError::Empty => "\"handle\": empty value not allowed".to_string(),
                        HandleError::InvalidFormat => "\"handle\": invalid format, expected only alphanumeric characters and hyphens, length between 4 and 31".to_string(),
                        HandleError::InvalidSpecificHandle => "\"handle\": value is not allowed".to_string(),
                    };
                    return Err(ApiError::BadRequest(error_message));
                }
                EmailSignupRequestError::InvalidPassword(err) => {
                    let error_message = match err {
                        PasswordError::Empty => "\"password\": empty value not allowed".to_string(),
                        PasswordError::InvalidFormat => "\"password\": invalid format, expected at least 8 characters, including uppercase, lowercase, digit and special character".to_string(),
                    };
                    return Err(ApiError::BadRequest(error_message));
                }
                EmailSignupRequestError::Unknown(err) => {
                    return Err(ApiError::InternalServerError(err));
                }
            };
        }
    };

    Ok((StatusCode::CREATED, "Signup email endpoint".into()))
}
