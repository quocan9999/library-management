package sparkminds.librarymanagement.profile.service;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.auth.service.InMemoryVerificationRateLimiter;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.profile.dto.ChangeEmailRequest;

@Service
@RequiredArgsConstructor
public class EmailChangeService {

    private final InMemoryVerificationRateLimiter rateLimiter;
    private final EmailChangeTransactionService transactionService;
    private final EmailChangeMailSender mailSender;

    public void requestChange(Integer accountId, ChangeEmailRequest request, String remoteAddress) {
        ensureAllowed(rateLimiter.consumeEmailChangeSendIpRequest(remoteAddress));
        try (var permit = rateLimiter.lockEmailOperation(request.newEmail())) {
            if (!permit.canSendEmail()) throw rateLimited();

            EmailChangeTransactionService.Candidate candidate = transactionService.createCandidate(accountId, request);
            try {
                mailSender.sendCode(candidate.email(), candidate.rawCode());
                permit.recordSuccessfulSend();
            } catch (MailException exception) {
                try {
                    transactionService.removeUnsentCandidate(candidate);
                } catch (RuntimeException compensationException) {
                    // Do not log raw SMTP, address, code or credentials.
                }
                throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "EMAIL_CHANGE_EMAIL_SEND_FAILED",
                        "Không thể gửi mã xác thực lúc này. Vui lòng thử lại sau.");
            }
        }
    }

    public void verify(Integer accountId, String code, String remoteAddress) {
        ensureAllowed(rateLimiter.consumeEmailChangeVerifyIpRequest(remoteAddress));
        try {
            transactionService.verify(accountId, code);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(HttpStatus.CONFLICT, "EMAIL_ALREADY_REGISTERED",
                    "Email này đã được sử dụng bởi tài khoản khác.");
        }
    }

    private static void ensureAllowed(InMemoryVerificationRateLimiter.IpLimitResult result) {
        if (!result.allowed()) throw rateLimited();
    }

    private static BusinessException rateLimited() {
        return new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "EMAIL_CHANGE_RATE_LIMITED",
                "Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau.");
    }
}
