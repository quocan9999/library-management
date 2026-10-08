
package sparkminds.librarymanagement.regression.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.context.ActiveProfiles;

import sparkminds.librarymanagement.auth.security.JwtAuthenticationFilter;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class JwtFilterRegistrationRegressionTests {

    @Autowired
    private FilterRegistrationBean<JwtAuthenticationFilter> registration;

    @Autowired
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Autowired
    private SecurityFilterChain securityFilterChain;

    /**
     * Đảm bảo JWT Filter không được đăng ký trực tiếp
     * vào Servlet Filter Chain.
     */
    @Test
    void jwtFilterShouldNotBeAutoRegistered() {
        assertThat(registration.isEnabled()).isFalse();

        assertThat(registration.getFilter())
                .isSameAs(jwtAuthenticationFilter);
    }

    /**
     * Đảm bảo JWT Filter xuất hiện đúng một lần
     * trong Spring Security Filter Chain.
     */
    @Test
    void jwtFilterShouldBeRegisteredOnceInSecurityChain() {
        assertThat(securityFilterChain.getFilters())
                .filteredOn(filter -> filter == jwtAuthenticationFilter)
                .hasSize(1);
    }
}
