package sparkminds.librarymanagement.auth.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.constraints.Size;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class RegisterRequestValidationTests {

    private static Validator validator;
    private static AutoCloseable validatorFactory;

    @BeforeAll
    static void createValidator() {
        var factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
        validatorFactory = factory;
    }

    @AfterAll
    static void closeValidatorFactory() throws Exception {
        validatorFactory.close();
    }

    @Test
    void normalizesEmailBeforeValidationAndPreservesPassword() {
        var request = new RegisterRequest("  Alice.Example@GMAIL.COM  ", "Strong1!");

        assertThat(request.email()).isEqualTo("alice.example@gmail.com");
        assertThat(request.password()).isEqualTo("Strong1!");
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void acceptsPasswordLengthBoundaries() {
        assertThat(violations("valid@example.com", "Aa1!bcde")).isEmpty();
        assertThat(violations("valid@example.com", "Aa1!bcdefghijklmnopq")).isEmpty();
    }

    @Test
    void rejectsMalformedBlankAndOverlongEmail() {
        assertThat(violations("not-an-email", "Strong1!")).contains("email");
        assertThat(violations("   ", "Strong1!")).contains("email");
        assertThat(violations("a".repeat(247) + "@test.com", "Strong1!")).contains("email");
        var overlongEmailViolations = validator.validate(
                new RegisterRequest("a".repeat(247) + "@test.com", "Strong1!"));
        assertThat(overlongEmailViolations).anyMatch(violation ->
                violation.getConstraintDescriptor().getAnnotation() instanceof Size);
    }

    @Test
    void rejectsPasswordLengthOutsideEightThroughTwenty() {
        assertThat(violations("valid@example.com", "Aa1!abc")).contains("password");
        assertThat(violations("valid@example.com", "Aa1!bcdefghijklmnopqr")).contains("password");
    }

    @Test
    void requiresUppercaseLowercaseDigitAndSpecialCharacter() {
        assertThat(violations("valid@example.com", "lowercase1!")).contains("password");
        assertThat(violations("valid@example.com", "UPPERCASE1!")).contains("password");
        assertThat(violations("valid@example.com", "NoDigit!!")).contains("password");
        assertThat(violations("valid@example.com", "NoSpecial1")).contains("password");
    }

    @Test
    void rejectsLeadingInnerAndTrailingPasswordWhitespace() {
        assertThat(violations("valid@example.com", " Strong1!")).contains("password");
        assertThat(violations("valid@example.com", "Str ong1!")).contains("password");
        assertThat(violations("valid@example.com", "Strong1! ")).contains("password");
        assertThat(violations("valid@example.com", "\u00A0Strong1!")).contains("password");
    }

    private Set<String> violations(String email, String password) {
        return validator.validate(new RegisterRequest(email, password)).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .collect(Collectors.toSet());
    }
}
