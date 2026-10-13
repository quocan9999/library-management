package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import java.time.Clock;
import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.EmailVerificationToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailVerificationTokenRepository;
import sparkminds.librarymanagement.common.api.BusinessException;

@Service
@RequiredArgsConstructor
public class VerificationTransactionService {

    private final AccountRepository accountRepository;
    private final EmailVerificationTokenRepository tokenRepository;
    private final Clock clock;

    /** Khóa Account rồi Token theo cùng thứ tự với resend để chỉ một request xác thực được token. */
    @Transactional
    public void verify(Integer tokenId, Integer accountId, String expectedTokenHash) {
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(this::invalidToken);
        EmailVerificationToken token = tokenRepository.findByIdForUpdate(tokenId)
                .orElseThrow(this::invalidToken);

        if (!token.getAccount().getId().equals(account.getId())
                || !token.getTokenHash().equals(expectedTokenHash)) {
            throw invalidToken();
        }
        if (token.getUsedAt() != null) {
            throw tokenError("VERIFICATION_TOKEN_USED", "Liên kết xác thực không còn hiệu lực");
        }

        LocalDateTime now = LocalDateTime.now(clock);
        if (!token.getExpiresAt().isAfter(now)) {
            throw tokenError("VERIFICATION_TOKEN_EXPIRED", "Liên kết xác thực đã hết hạn");
        }

        EmailVerificationToken latestToken = tokenRepository.findFirstByAccountIdOrderByIdDesc(accountId)
                .orElseThrow(this::invalidToken);
        if (!latestToken.getId().equals(token.getId())) {
            throw tokenError(
                    "VERIFICATION_TOKEN_REVOKED",
                    "Liên kết xác thực đã được thay thế. Vui lòng dùng email mới nhất"
            );
        }

        account.setEmailVerified(true);
        token.setUsedAt(now);
        accountRepository.save(account);
        tokenRepository.save(token);
    }

    private BusinessException invalidToken() {
        return tokenError("VERIFICATION_TOKEN_INVALID", "Liên kết xác thực không hợp lệ");
    }

    private BusinessException tokenError(String code, String message) {
        return new BusinessException(HttpStatus.BAD_REQUEST, code, message);
    }
}
