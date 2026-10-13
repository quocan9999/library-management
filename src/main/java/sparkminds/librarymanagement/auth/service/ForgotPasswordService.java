package sparkminds.librarymanagement.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ForgotPasswordService {

    private final InMemoryVerificationRateLimiter rateLimiter;
    private final PasswordResetTransactionService transactionService;
    private final PasswordResetMailSender mailSender;
    private final TaskExecutor mailExecutor;

    public ForgotPasswordService(
            InMemoryVerificationRateLimiter rateLimiter,
            PasswordResetTransactionService transactionService,
            PasswordResetMailSender mailSender,
            @Qualifier("verificationMailExecutor") TaskExecutor mailExecutor
    ) {
        this.rateLimiter = rateLimiter;
        this.transactionService = transactionService;
        this.mailSender = mailSender;
        this.mailExecutor = mailExecutor;
    }

    public void requestReset(String email) {
        try {
            mailExecutor.execute(() -> {
                try {
                    performRequest(email);
                } catch (RuntimeException exception) {
                    log.error("Lỗi xử lý yêu cầu đặt lại mật khẩu; loại lỗi={}",
                            exception.getClass().getSimpleName());
                }
            });
        } catch (TaskRejectedException exception) {
            log.warn("Hàng đợi gửi email đặt lại mật khẩu đang bận");
        }
    }

    private void performRequest(String email) {
        try (var permit = rateLimiter.lockEmailOperation(email)) {
            if (!permit.canSendEmail()) {
                return;
            }

            PasswordResetTransactionService.Candidate candidate = transactionService.createCandidate(email);
            if (candidate == null) {
                return;
            }

            try {
                mailSender.sendResetPasswordEmail(candidate.email(), candidate.rawToken());
                permit.recordSuccessfulSend();
            } catch (MailException exception) {
                log.warn("Không gửi được email đặt lại mật khẩu; loại lỗi={}",
                        exception.getClass().getSimpleName());
                try {
                    transactionService.removeUnsentCandidate(candidate);
                } catch (RuntimeException compensationException) {
                    log.error("Không khôi phục được token đặt lại mật khẩu sau lỗi SMTP; loại lỗi={}",
                            compensationException.getClass().getSimpleName());
                }
            }
        }
    }
}
