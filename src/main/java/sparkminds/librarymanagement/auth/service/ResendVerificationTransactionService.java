package sparkminds.librarymanagement.auth.service;

import lombok.RequiredArgsConstructor;
import java.time.Clock;
import java.time.LocalDateTime;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailVerificationTokenRepository;

@Service
@RequiredArgsConstructor
public class ResendVerificationTransactionService {

    private final AccountRepository accountRepository;
    private final EmailVerificationTokenRepository tokenRepository;
    private final VerificationTokenService tokenService;
    private final Clock clock;

    /** Commit ứng viên trước khi SMTP chạy để khóa DB không bị giữ trong lúc chờ mạng. */
    @Transactional
    public Candidate createCandidate(String email) {
        Account account = accountRepository.findByEmailForUpdate(email).orElse(null);
        if (account == null || account.isEmailVerified()) {
            return null;
        }

        VerificationTokenService.IssuedToken issued = tokenService.issue(account);
        tokenRepository.saveAndFlush(issued.token());
        return new Candidate(account.getId(), account.getEmail(), issued.rawToken(), issued.token().getId(),
                issued.token().getTokenHash());
    }

    /** Khôi phục token cũ nếu SMTP từ chối gửi và ứng viên vẫn là token mới nhất. */
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
                    && tokenRepository.findFirstByAccountIdOrderByIdDesc(account.getId())
                            .map(latest -> latest.getId().equals(token.getId()))
                            .orElse(false)) {
                tokenRepository.delete(token);
                tokenRepository.flush();
            }
        });
    }

    public record Candidate(Integer accountId, String email, String rawToken, Integer tokenId, String tokenHash) {
    }
}
