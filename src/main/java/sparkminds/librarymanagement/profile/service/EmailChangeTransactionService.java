package sparkminds.librarymanagement.profile.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.auth.entity.EmailChangeVerification;
import sparkminds.librarymanagement.auth.repository.AccountRepository;
import sparkminds.librarymanagement.auth.repository.EmailChangeVerificationRepository;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.FieldValidationException;
import sparkminds.librarymanagement.profile.dto.ChangeEmailRequest;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EmailChangeTransactionService {

    private final AccountRepository accountRepository;
    private final EmailChangeVerificationRepository verificationRepository;
    private final EmailChangeCodeService codeService;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager entityManager;
    private final Clock clock;

    /** Lưu mã trước khi gửi thư; transaction kết thúc trước khi SMTP được gọi. */
    @Transactional
    public Candidate createCandidate(Integer accountId, ChangeEmailRequest request) {
        Account account = lockActiveUser(accountId);
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);

        if (!passwordEncoder.matches(request.currentPassword(), account.getPasswordHash())) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_INVALID",
                    "Mật khẩu hiện tại không chính xác");
        }
        if (request.newEmail().equalsIgnoreCase(account.getEmail())) {
            throw new FieldValidationException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "Email mới phải khác email hiện tại", Map.of("newEmail", "Email mới phải khác email hiện tại"));
        }
        if (accountRepository.existsByEmailIgnoreCase(request.newEmail())) {
            throw emailAlreadyRegistered();
        }

        LocalDateTime now = LocalDateTime.now(clock);
        verificationRepository.invalidatePendingForAccount(accountId, now);
        EmailChangeCodeService.IssuedCode issued = codeService.issue(account, request.newEmail());
        EmailChangeVerification verification = verificationRepository.saveAndFlush(issued.verification());
        return new Candidate(accountId, verification.getId(), request.newEmail(), issued.rawCode());
    }

    @Transactional
    public void removeUnsentCandidate(Candidate candidate) {
        Account account = accountRepository.findByIdForUpdate(candidate.accountId()).orElse(null);
        if (account == null) return;
        verificationRepository.findByIdForUpdate(candidate.verificationId()).ifPresent(verification -> {
            boolean isLatest = verificationRepository
                    .findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDescIdDesc(candidate.accountId())
                    .map(latest -> latest.getId().equals(verification.getId()))
                    .orElse(false);
            if (isLatest && verification.getAccount().getId().equals(account.getId())) {
                verificationRepository.delete(verification);
                verificationRepository.flush();
            }
        });
    }

    /** Account luôn được khóa trước verification để serialize hai lần xác nhận cùng một mã. */
    @Transactional
    public void verify(Integer accountId, String rawCode) {
        Account account = lockActiveUser(accountId);
        entityManager.refresh(account, LockModeType.PESSIMISTIC_WRITE);
        EmailChangeVerification verification = verificationRepository
                .findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDescIdDesc(accountId)
                .orElseThrow(EmailChangeTransactionService::invalidCode);

        LocalDateTime now = LocalDateTime.now(clock);
        if (!verification.getAccount().getId().equals(accountId)
                || verification.getUsedAt() != null
                || !verification.getExpiresAt().isAfter(now)
                || !codeService.matches(rawCode, verification.getCodeHash())) {
            throw invalidCode();
        }
        if (accountRepository.existsByEmailIgnoreCase(verification.getNewEmail())) {
            throw emailAlreadyRegistered();
        }

        verification.setUsedAt(now);
        account.setEmail(verification.getNewEmail());
        // emailVerified is intentionally unchanged: Master Spec §8 preserves the existing flag.
        accountRepository.flush();
        verificationRepository.flush();
    }

    private Account lockActiveUser(Integer accountId) {
        Account account = accountRepository.findByIdForUpdate(accountId)
                .orElseThrow(EmailChangeTransactionService::invalidCode);
        if (!"ROLE_USER".equals(account.getRole().getCode()) || !account.isEnabled()) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "PERMISSION_DENIED",
                    "Bạn không có quyền truy cập tài nguyên này");
        }
        return account;
    }

    private static BusinessException invalidCode() {
        return new BusinessException(HttpStatus.BAD_REQUEST, "EMAIL_CHANGE_CODE_INVALID",
                "Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.");
    }

    private static BusinessException emailAlreadyRegistered() {
        return new BusinessException(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED",
                "Email này đã được sử dụng bởi tài khoản khác.");
    }

    public record Candidate(Integer accountId, Integer verificationId, String email, String rawCode) {
    }
}
