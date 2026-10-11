package sparkminds.librarymanagement.auth.security;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import sparkminds.librarymanagement.auth.entity.Account;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

public final class CustomUserPrincipal implements UserDetails {

    private final Integer accountId;
    private final String username;
    private final String passwordHash;
    private final boolean enabled;
    private final String roleCode;
    private final Set<GrantedAuthority> authorities;

    private CustomUserPrincipal(
            Integer accountId,
            String username,
            String passwordHash,
            boolean enabled,
            String roleCode,
            Set<GrantedAuthority> authorities
    ) {
        this.accountId = accountId;
        this.username = username;
        this.passwordHash = passwordHash;
        this.enabled = enabled;
        this.roleCode = roleCode;
        this.authorities = authorities;
    }

    public static CustomUserPrincipal from(Account account, Collection<String> effectivePermissions) {
        Set<GrantedAuthority> authorities = effectivePermissions.stream()
                .sorted()
                .map(SimpleGrantedAuthority::new)
                .collect(Collectors.collectingAndThen(
                        Collectors.toCollection(LinkedHashSet::new),
                        Collections::unmodifiableSet
                ));

        String loginName = account.getUsername() != null ? account.getUsername() : account.getEmail();
        return new CustomUserPrincipal(
                account.getId(),
                loginName,
                account.getPasswordHash(),
                account.isEnabled(),
                account.getRole().getCode(),
                authorities
        );
    }

    public Integer getAccountId() {
        return accountId;
    }

    public String getRoleCode() {
        return roleCode;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }
}
