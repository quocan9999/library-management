package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.PasswordResetToken;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.PasswordResetTokenRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PasswordResetTransactionService {

    private final AccountRepository accountRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordResetTokenService tokenService;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    /** Commit token candidate trước SMTP để không giữ DB lock trong lúc chờ mạng. */
    @Transactional
    public Candidate createCandidate(String email) {
        Account account = accountRepository.findByEmailForUpdate(email).orElse(null);
        if (account == null || !"USER".equals(account.getRole().getCode())
                || !account.isEnabled() || !account.isEmailVerified()) {
            return null;
        }

        PasswordResetTokenService.IssuedToken issued = tokenService.issue(account);
        tokenRepository.saveAndFlush(issued.token());
        return new Candidate(account.getId(), account.getEmail(), issued.rawToken(),
                issued.token().getId(), issued.token().getTokenHash());
    }

    /** Xóa candidate SMTP chưa gửi để token reset trước đó vẫn là token mới nhất. */
    @Transactional
    public void removeUnsentCandidate(Candidate candidate) {
        Account account = accountRepository.findByIdForUpdate(candidate.accountId()).orElse(null);
        if (account == null) {
            return;
        }
        tokenRepository.findByIdForUpdate(candidate.tokenId()).ifPresent(token -> {
            if (token.getAccount().getId().equals(account.getId())
                    && token.getTokenHash().equals(candidate.tokenHash())
                    && token.getUsedAt() == null
                    && tokenRepository.findFirstByAccount_IdOrderByIdDesc(account.getId())
                            .map(latest -> latest.getId().equals(token.getId()))
                            .orElse(false)) {
                tokenRepository.delete(token);
                tokenRepository.flush();
            }
        });
    }

    /** Account là khóa gốc; mọi thao tác reset và phát hành token khóa theo cùng thứ tự. */
    @Transactional
    public void reset(Integer tokenId, Integer accountId, String tokenHash, String newPassword) {
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(PasswordResetTransactionService::invalidToken);
        if (!"USER".equals(account.getRole().getCode()) || !account.isEnabled() || !account.isEmailVerified()) {
            throw invalidToken();
        }

        PasswordResetToken token = tokenRepository.findByIdForUpdate(tokenId)
                .orElseThrow(PasswordResetTransactionService::invalidToken);
        LocalDateTime now = LocalDateTime.now(clock);
        boolean isLatest = tokenRepository.findFirstByAccount_IdOrderByIdDesc(accountId)
                .map(latest -> latest.getId().equals(tokenId))
                .orElse(false);
        if (!token.getAccount().getId().equals(accountId)
                || !token.getTokenHash().equals(tokenHash)
                || token.getUsedAt() != null
                || !token.getExpiresAt().isAfter(now)
                || !isLatest) {
            throw invalidToken();
        }

        if (passwordEncoder.matches(newPassword, account.getPasswordHash())) {
            throw new FieldValidationException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "Mật khẩu mới phải khác mật khẩu hiện tại",
                    Map.of("newPassword", "Mật khẩu mới phải khác mật khẩu hiện tại"));
        }

        token.setUsedAt(now);
        account.setPasswordHash(passwordEncoder.encode(newPassword));
        account.setSessionVersion(account.getSessionVersion() + 1);
        account.setLastSessionChangeReason("PASSWORD_RESET");
    }

    private static BusinessException invalidToken() {
        return new BusinessException(
                HttpStatus.BAD_REQUEST,
                "PASSWORD_RESET_TOKEN_INVALID",
                "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu liên kết mới."
        );
    }

    public record Candidate(Integer accountId, String email, String rawToken, Integer tokenId, String tokenHash) {
    }
}
