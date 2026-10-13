package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.dto.ResetPasswordRequest;
import sparkminds.librarymanagement.auth.repository.PasswordResetTokenRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordResetTokenService tokenService;
    private final PasswordResetTransactionService transactionService;
    private final InMemoryVerificationRateLimiter rateLimiter;

    public void reset(ResetPasswordRequest request) {
        if (!request.newPassword().equals(request.confirmNewPassword())) {
            throw new FieldValidationException(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "VALIDATION_ERROR",
                    "Mật khẩu xác nhận không khớp",
                    Map.of("confirmNewPassword", "Mật khẩu xác nhận không khớp")
            );
        }

        String tokenHash = tokenService.hash(request.token());
        PasswordResetTokenRepository.TokenReference reference = tokenRepository.findReferenceByTokenHash(tokenHash)
                .orElseThrow(PasswordResetService::invalidToken);

        // Cùng khóa email với forgot request để không chấp nhận token cũ khi email mới đang được gửi.
        try (var permit = rateLimiter.lockEmailOperation(reference.getEmail())) {
            transactionService.reset(reference.getTokenId(), reference.getAccountId(), tokenHash, request.newPassword());
        }
    }

    private static BusinessException invalidToken() {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "PASSWORD_RESET_TOKEN_INVALID",
                "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới."
        );
    }
}
