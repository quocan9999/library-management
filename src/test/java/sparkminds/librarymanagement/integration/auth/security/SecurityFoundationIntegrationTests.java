package sparkminds.librarymanagement.integration.auth.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class SecurityFoundationIntegrationTests {

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void loadsAdminWithDatabasePermissionsAndAuthenticatesWithBcrypt() throws Exception {
        assertThatCode(() -> userDetailsService.loadUserByUsername("admin")).doesNotThrowAnyException();
        UserDetails admin = userDetailsService.loadUserByUsername("admin");
        Account adminAccount = accountRepository.findByUsername("admin").orElseThrow();

        assertThat(admin.getUsername()).isEqualTo("admin");
        assertThat(adminAccount.getRole().getCode()).isEqualTo("ADMIN");
        assertThat(admin.getPassword()).isNotEqualTo("admin");
        assertThat(admin.getAuthorities())
                .extracting("authority")
                .contains("book:read", "book:create");
        assertThat(authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated("admin", "admin")
        ).isAuthenticated()).isTrue();
    }

    @Test
    void loadsDemoUserByEmailAndAuthenticatesItsBcryptPassword() throws Exception {
        assertThatCode(() -> userDetailsService.loadUserByUsername("user@gmail.com")).doesNotThrowAnyException();
        UserDetails user = userDetailsService.loadUserByUsername("user@gmail.com");
        Account userAccount = accountRepository.findByEmail("user@gmail.com").orElseThrow();

        assertThat(user.getUsername()).isEqualTo("user");
        assertThat(userAccount.isEnabled()).isTrue();
        assertThat(userAccount.isEmailVerified()).isTrue();
        assertThat(userAccount.getRole().getCode()).isEqualTo("USER");
        assertThat(user.getPassword()).isNotEqualTo("user");
        assertThat(user.getAuthorities())
                .extracting("authority")
                .contains("book:read", "borrow:create");
        assertThat(authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated("user", "user")
        ).isAuthenticated()).isTrue();
    }

    @Test
    void rejectsWrongPasswordForKnownAccount() throws Exception {
        assertThatThrownBy(() -> authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated("admin", "wrong-password")
        )).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void exposesDisabledDatabaseAccountAsDisabledUserDetails() {
        Account admin = accountRepository.findByUsername("admin").orElseThrow();
        admin.setEnabled(false);
        accountRepository.saveAndFlush(admin);

        assertThatCode(() -> userDetailsService.loadUserByUsername("admin")).doesNotThrowAnyException();
        UserDetails details = userDetailsService.loadUserByUsername("admin");
        assertThat(details.isEnabled()).isFalse();
        assertThatThrownBy(() -> authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated("admin", "admin")
        )).isInstanceOf(DisabledException.class);
    }

    @Test
    void allowsCredentialedPreflightFromConfiguredLocalFrontend() throws Exception {
        mockMvc.perform(options("/api/v1/auth/login")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Authorization,Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void doesNotCreateHttpSessionForUnauthenticatedRequest() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/protected-resource")).andReturn();

        assertThat(result.getRequest().getSession(false)).isNull();
    }
}
