package sparkminds.librarymanagement.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import java.util.stream.Collectors;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import sparkminds.librarymanagement.security.userdetails.AccountPrincipal;

@SpringBootTest(properties = "spring.liquibase.enabled=false")
class SecurityFoundationIntegrationTest {

    private static final Set<String> ADMIN_AUTHORITIES = Set.of(
            "ROLE_ADMIN",
            "book:read",
            "book:create",
            "book:update",
            "book:delete",
            "book:import",
            "member:read",
            "member:create",
            "member:update",
            "member:delete",
            "config:read",
            "config:update");

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Test
    void loadsSeededAdminRoleAndPermissionAuthorities() {
        UserDetails userDetails = userDetailsService.loadUserByUsername("admin");

        Set<String> authorities = userDetails.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet());

        assertEquals("admin", userDetails.getUsername());
        assertEquals(ADMIN_AUTHORITIES, authorities);
    }

    @Test
    void authenticatesSeededAdminWithTheStoredBcryptPassword() {
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated("admin", "admin"));

        assertTrue(authentication.isAuthenticated());
        AccountPrincipal principal = assertInstanceOf(AccountPrincipal.class, authentication.getPrincipal());
        assertNull(principal.getPassword(), "successful authentication must erase the stored password hash");
        assertEquals(ADMIN_AUTHORITIES, principal.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet()));
        assertTrue(authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority())
                .collect(Collectors.toSet())
                .containsAll(ADMIN_AUTHORITIES));
    }

    @Test
    void rejectsWrongPasswordForSeededAdmin() {
        assertThrows(BadCredentialsException.class, () -> authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated("admin", "wrong-password")));
    }

    @Test
    void rejectsUnknownUsername() {
        assertThrows(UsernameNotFoundException.class,
                () -> userDetailsService.loadUserByUsername("missing-user-for-security-test"));
    }
}
