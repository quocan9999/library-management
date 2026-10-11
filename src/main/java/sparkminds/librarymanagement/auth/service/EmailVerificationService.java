package sparkminds.librarymanagement.auth.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.repository.EmailVerificationTokenRepository;
import sparkminds.librarymanagement.common.api.BusinessException;

@Service
public class EmailVerificationService {

    private final EmailVerificationTokenRepository tokenRepository;
    private final VerificationTokenService tokenService;
    private final VerificationTransactionService transactionService;
    private final InMemoryVerificationRateLimiter rateLimiter;

    public EmailVerificationService(
            EmailVerificationTokenRepository tokenRepository,
            VerificationTokenService tokenService,
            VerificationTransactionService transactionService,
            InMemoryVerificationRateLimiter rateLimiter
    ) {
        this.tokenRepository = tokenRepository;
        this.tokenService = tokenService;
        this.transactionService = transactionService;
        this.rateLimiter = rateLimiter;
    }

    /** Chỉ chuyển hash và định danh DB vào transaction; token thô không được lưu hoặc ghi log. */
    public void verify(String rawToken) {
        String tokenHash = tokenService.hash(rawToken);
        var tokenReference = tokenRepository.findTokenReferenceByTokenHash(tokenHash)
                .orElseThrow(() -> new BusinessException(
                        HttpStatus.BAD_REQUEST,
                        "VERIFICATION_TOKEN_INVALID",
                        "Liên kết xác thực không hợp lệ"
                ));

        // Đồng bộ với resend trước khi khóa DB để token cũ không bị báo revoked khi SMTP còn chạy.
        try (var permit = rateLimiter.lockEmailOperation(tokenReference.getEmail())) {
            transactionService.verify(tokenReference.getTokenId(), tokenReference.getAccountId(), tokenHash);
        }
    }
}
