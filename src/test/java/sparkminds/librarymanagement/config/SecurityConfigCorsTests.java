package sparkminds.librarymanagement.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityConfigCorsTests {

    @Test
    void allowsConfiguredFrontendAndExposesRetryAfterForResendFeedback() {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/v1/auth/resend-verification");
        CorsConfiguration configuration = new SecurityConfig()
                .corsConfigurationSource("http://localhost:5173")
                .getCorsConfiguration(request);

        assertThat(configuration).isNotNull();
        assertThat(configuration.checkOrigin("http://localhost:5173")).isEqualTo("http://localhost:5173");
        assertThat(configuration.checkOrigin("http://localhost:5174")).isNull();
        assertThat(configuration.getAllowCredentials()).isTrue();
        assertThat(configuration.getExposedHeaders()).containsExactly("Retry-After");
        assertThat(configuration.checkHeaders(List.of("Authorization", "Content-Type")))
                .containsExactlyInAnyOrder("Authorization", "Content-Type");
    }

    @Test
    void allowsIsolatedWorktreeFrontendFromConfiguredOrigin() {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/v1/auth/login");
        CorsConfiguration configuration = new SecurityConfig()
                .corsConfigurationSource("http://localhost:5174/")
                .getCorsConfiguration(request);

        assertThat(configuration).isNotNull();
        assertThat(configuration.checkOrigin("http://localhost:5174")).isEqualTo("http://localhost:5174");
        assertThat(configuration.checkOrigin("http://localhost:5173")).isNull();
    }
}
