use tracing::info;

use crate::users::models::{
    auth_credential::AuthCredential, email_signup::EmailSignupError, user::User,
};

#[async_trait::async_trait]
/// Defines the UsersNotifier trait for users related notifications
pub trait UsersNotifier: Send + Sync + 'static {
    /// Triggers a notification when user signed up with email
    /// # Errors
    /// * `EmailSignupError::Unknown` for any errors that may occur during the process.
    async fn user_signed_up_with_email(
        &self,
        user: &User,
        auth_credential: &AuthCredential,
    ) -> Result<(), EmailSignupError>;
}

#[derive(Clone)]
pub struct UsersNotifierImpl;

impl Default for UsersNotifierImpl {
    fn default() -> Self {
        Self
    }
}

#[async_trait::async_trait]
impl UsersNotifier for UsersNotifierImpl {
    async fn user_signed_up_with_email(
        &self,
        user: &User,
        _auth_credential: &AuthCredential,
    ) -> Result<(), EmailSignupError> {
        info!(
            "sending notification for user signed up with email: {}",
            user.email
        );
        Ok(())
    }
}
