package sparkminds.librarymanagement.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.mail.javamail.JavaMailSender;

class RegistrationMailSenderTests {

    @Test
    void encodesReservedTokenCharactersInVerificationQueryParameter() {
        var sender = new RegistrationMailSender(
                mock(JavaMailSender.class), "notify@example.test", "http://localhost:5174/");

        assertThat(sender.buildVerificationLink("raw+token/with=reserved"))
                .isEqualTo("http://localhost:5174/verify-email?token=raw%2Btoken%2Fwith%3Dreserved");
    }
}
