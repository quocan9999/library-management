package sparkminds.librarymanagement.auth.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Set;
import java.util.stream.Collectors;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class VerificationRequestValidationTests {

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
    void normalizesResendEmailBeforeValidation() {
        var request = new ResendVerificationRequest("  Reader.Example@GMAIL.COM  ");

        assertThat(request.email()).isEqualTo("reader.example@gmail.com");
        assertThat(validator.validate(request)).isEmpty();
    }

    @Test
    void rejectsBlankMalformedAndOverlongResendEmail() {
        assertThat(resendViolations(" ")).contains("email");
        assertThat(resendViolations("not-an-email")).contains("email");
        assertThat(resendViolations("a".repeat(247) + "@example.com")).contains("email");
    }

    @Test
    void rejectsBlankAndOverlongVerificationToken() {
        assertThat(verifyViolations(" \t ")).contains("token");
        assertThat(verifyViolations("x".repeat(129))).contains("token");
    }

    @Test
    void preservesNonblankVerificationTokenExactly() {
        String rawToken = "  token%2Bvalue+/==  ";
        var request = new VerifyEmailRequest(rawToken);

        assertThat(request.token()).isEqualTo(rawToken);
        assertThat(validator.validate(request)).isEmpty();
    }

    private Set<String> resendViolations(String email) {
        return validator.validate(new ResendVerificationRequest(email)).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .collect(Collectors.toSet());
    }

    private Set<String> verifyViolations(String token) {
        return validator.validate(new VerifyEmailRequest(token)).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .collect(Collectors.toSet());
    }
}
