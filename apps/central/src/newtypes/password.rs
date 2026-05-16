use fake::{Dummy, Fake, faker, rand};

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Password(String);

#[derive(Debug)]
pub enum PasswordError {
    Empty,
    InvalidFormat,
}

const MIN_PASSWORD_LENGTH: usize = 8;
const MIN_UPPERCASE_COUNT: usize = 1;
const MIN_LOWERCASE_COUNT: usize = 1;
const MIN_DIGIT_COUNT: usize = 1;
const MIN_SPECIAL_COUNT: usize = 1;

impl Password {
    /// Creates a new `Password` instance from a string slice, validating its format.
    /// # Arguments
    /// * `password` - Input password string to be validated and stored.
    /// # Errors
    /// * `PasswordError::Empty` - Returned if the input password string is empty after trimming.
    /// * `PasswordError::InvalidFormat` - Returned if the input password string does not conform to a valid format.
    pub fn new(password: &str) -> Result<Self, PasswordError> {
        let trimmed = password.trim();
        if trimmed.is_empty() {
            return Err(PasswordError::Empty);
        }

        if trimmed.len() < MIN_PASSWORD_LENGTH {
            return Err(PasswordError::InvalidFormat);
        }

        // A valid password must contain at least:
        // - One uppercase letter
        // - One lowercase letter
        // - One digit
        // - One special character
        let mut uppercase_count = 0;
        let mut lowercase_count = 0;
        let mut digit_count = 0;
        let mut special_count = 0;
        for c in trimmed.chars() {
            if c.is_ascii_uppercase() {
                uppercase_count += 1;
            } else if c.is_ascii_lowercase() {
                lowercase_count += 1;
            } else if c.is_ascii_digit() {
                digit_count += 1;
            } else if !c.is_ascii_alphanumeric() {
                special_count += 1;
            }
        }

        if uppercase_count < MIN_UPPERCASE_COUNT
            || lowercase_count < MIN_LOWERCASE_COUNT
            || digit_count < MIN_DIGIT_COUNT
            || special_count < MIN_SPECIAL_COUNT
        {
            return Err(PasswordError::InvalidFormat);
        }

        Ok(Self(trimmed.to_string()))
    }

    /// Returns a string slice containing the password.
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<T> Dummy<T> for Password {
    fn dummy_with_rng<R: rand::Rng + ?Sized>(_: &T, rng: &mut R) -> Self {
        let mut password: String = faker::internet::en::Password(8..30).fake_with_rng(rng);
        // Ensure the generated password meets the complexity requirements
        password.push_str("Aa1!"); // Add characters to meet the requirements
        Password::new(&password).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_password() {
        let password = Password::new("ValidPassword1!").unwrap();
        assert_eq!(password.as_str(), "ValidPassword1!");
    }

    #[test]
    fn test_empty_password() {
        let result = Password::new("   ");
        assert!(matches!(result, Err(PasswordError::Empty)));
    }

    #[test]
    fn test_invalid_format_password() {
        let result = Password::new("short");
        assert!(matches!(result, Err(PasswordError::InvalidFormat)));

        let result = Password::new("alllowercase1!");
        assert!(matches!(result, Err(PasswordError::InvalidFormat)));

        let result = Password::new("ALLUPPERCASE1!");
        assert!(matches!(result, Err(PasswordError::InvalidFormat)));

        let result = Password::new("NoDigits!");
        assert!(matches!(result, Err(PasswordError::InvalidFormat)));

        let result = Password::new("NoSpecialChar1");
        assert!(matches!(result, Err(PasswordError::InvalidFormat)));
    }
}
