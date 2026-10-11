package sparkminds.librarymanagement.auth.security;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.repository.AccountRepository;

import java.util.Locale;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    private final AccountRepository accountRepository;
    private final EffectivePermissionService effectivePermissionService;

    public CustomUserDetailsService(
            AccountRepository accountRepository,
            EffectivePermissionService effectivePermissionService
    ) {
        this.accountRepository = accountRepository;
        this.effectivePermissionService = effectivePermissionService;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        if (identifier == null || identifier.isBlank()) {
            throw new UsernameNotFoundException("User not found");
        }

        var account = identifier.contains("@")
                ? accountRepository.findByEmailIgnoreCase(identifier.trim().toLowerCase(Locale.ROOT))
                : accountRepository.findByUsernameOrEmail(identifier, identifier);

        return account
                .map(value -> CustomUserPrincipal.from(value, effectivePermissionService.resolve(value)))
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }
}
