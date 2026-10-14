package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.dto.AuthMeResponse;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.auth.security.EffectivePermissionService;
import sparkminds.librarymanagement.common.api.BusinessException;
@Service
@RequiredArgsConstructor
public class AuthMeService {

    private final AccountRepository accountRepository;
    private final EffectivePermissionService effectivePermissionService;

    @Transactional(readOnly = true)
    public AuthMeResponse getCurrentAccount(CustomUserPrincipal principal) {
        var account = accountRepository.findById(principal.getAccountId())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED,
                        "AUTH_TOKEN_INVALID",
                        "Access Token không hợp lệ"
                ));
        return new AuthMeResponse(
                account.getId(),
                account.getUsername(),
                account.getEmail(),
                account.getRole().getCode(),
                effectivePermissionService.resolveCurrentRoleCode(account.getRole().getCode())
        );
    }
}
