package sparkminds.librarymanagement.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;

@Service
@Slf4j
public class ResendVerificationService {

    private final InMemoryVerificationRateLimiter rateLimiter;
    private final ResendVerificationTransactionService transactionService;
    private final RegistrationMailSender mailSender;
    private final TaskExecutor mailExecutor;

    public ResendVerificationService(
            InMemoryVerificationRateLimiter rateLimiter,
            ResendVerificationTransactionService transactionService,
            RegistrationMailSender mailSender,
            @Qualifier("verificationMailExecutor") TaskExecutor mailExecutor
    ) {
        this.rateLimiter = rateLimiter;
        this.transactionService = transactionService;
        this.mailSender = mailSender;
        this.mailExecutor = mailExecutor;
    }

    /**
     * Luôn tiếp nhận yêu cầu nhanh, không phân biệt email có tồn tại hay đã xác thực.
     * Đẩy cả bước tra DB và SMTP vào worker để không lộ trạng thái tài khoản qua thời gian HTTP.
     */
    public void resend(String email) {
        try {
            mailExecutor.execute(() -> {
                try {
                    performResend(email);
                } catch (RuntimeException exception) {
                    // Worker không in exception message/stacktrace có thể chứa email hoặc token.
                    log.error("Lỗi xử lý gửi lại email xác thực; loại lỗi={}",
                            exception.getClass().getSimpleName());
                }
            });
        } catch (TaskRejectedException exception) {
            // Khi hàng đợi đầy vẫn giữ cùng response chung; không tiết lộ email hoặc trạng thái.
            log.warn("Hàng đợi gửi email xác thực đang bận");
        }
    }

    /** Khóa theo email; giữ transaction DB ngắn và xử lý SMTP failure trong worker. */
    private void performResend(String email) {
        try (var permit = rateLimiter.lockEmailOperation(email)) {
            if (!permit.canSendEmail()) {
                return;
            }

            ResendVerificationTransactionService.Candidate candidate = transactionService.createCandidate(email);
            if (candidate == null) {
                return;
            }

            try {
                mailSender.sendVerificationEmail(candidate.email(), candidate.rawToken());
                permit.recordSuccessfulSend();
            } catch (MailException mailException) {
                // Chỉ ghi loại lỗi SMTP; không ghi địa chỉ, token, URL hay chi tiết máy chủ mail.
                log.warn("Không gửi được email xác thực; loại lỗi={}", mailException.getClass().getSimpleName());
                try {
                    transactionService.removeUnsentCandidate(candidate);
                } catch (RuntimeException compensationException) {
                    log.error("Không khôi phục được token xác thực sau lỗi SMTP; loại lỗi={}",
                            compensationException.getClass().getSimpleName());
                }
            }
        }
    }
}
