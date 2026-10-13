package sparkminds.librarymanagement.profile.service;

import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;
import sparkminds.librarymanagement.profile.dto.ChangePasswordRequest;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class PasswordChangeService {

    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;

    @Transactional
    public void changePassword(CustomUserPrincipal principal, ChangePasswordRequest request) {
        var account = accountRepository.findByIdForUpdate(principal.getAccountId())
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.UNAUTHORIZED,
                        "AUTH_TOKEN_INVALID",
                        "Access Token không hợp lệ"
                ));
        // Authentication may have loaded this account earlier in the request; refresh after locking to
        // compare against the latest password hash when two change requests arrive concurrently.
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);

        String currentPasswordHash = account.getPasswordHash();
        if (!passwordEncoder.matches(request.currentPassword(), currentPasswordHash)) {
            throw new BusinessException(
                    HttpStatus.BAD_REQUEST,
                    "CURRENT_PASSWORD_INVALID",
                    "Mật khẩu hiện tại không chính xác"
            );
        }

        if (passwordEncoder.matches(request.newPassword(), currentPasswordHash)) {
            throw new FieldValidationException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VALIDATION_ERROR",
                    "Mật khẩu mới phải khác mật khẩu hiện tại",
                    Map.of("newPassword", "Mật khẩu mới phải khác mật khẩu hiện tại")
            );
        }

        if (!request.newPassword().equals(request.confirmNewPassword())) {
            throw new FieldValidationException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VALIDATION_ERROR",
                    "Mật khẩu xác nhận không khớp",
                    Map.of("confirmNewPassword", "Mật khẩu xác nhận không khớp")
            );
        }

        account.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    }
}
