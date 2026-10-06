package sparkminds.librarymanagement.security.userdetails;

import java.util.stream.Collectors;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import sparkminds.librarymanagement.entity.Account;
import sparkminds.librarymanagement.repository.AccountRepository;

@Service
public class AccountUserDetailsService implements UserDetailsService {

    private final AccountRepository accountRepository;

    public AccountUserDetailsService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("Account not found"));

        var role = account.getRole();
        var permissionCodes = role.getPermissions().stream()
                .map(permission -> permission.getCode())
                .collect(Collectors.toUnmodifiableSet());

        return new AccountPrincipal(
                account.getUsername(),
                account.getPasswordHash(),
                account.isEnabled(),
                role.getCode(),
                permissionCodes);
    }
}
