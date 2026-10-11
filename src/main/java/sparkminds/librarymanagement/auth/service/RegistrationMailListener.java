package sparkminds.librarymanagement.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
public class RegistrationMailListener {

    private static final Logger logger = LoggerFactory.getLogger(RegistrationMailListener.class);

    private final RegistrationMailSender mailSender;
    private final InMemoryVerificationRateLimiter rateLimiter;

    public RegistrationMailListener(
            RegistrationMailSender mailSender,
            InMemoryVerificationRateLimiter rateLimiter
    ) {
        this.mailSender = mailSender;
        this.rateLimiter = rateLimiter;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendAfterCommit(RegistrationMailRequested event) {
        try (var permit = rateLimiter.lockEmailOperation(event.email())) {
            if (!permit.canSendEmail()) {
                logger.warn("Đã bỏ qua email xác thực đăng ký do giới hạn gửi; loại lỗi=EmailRateLimit");
                return;
            }
            mailSender.sendVerificationEmail(event.email(), event.rawToken());
            permit.recordSuccessfulSend();
        } catch (Exception exception) {
            // SMTP lỗi không được đổi kết quả đăng ký; log duy nhất tên lớp lỗi để tránh lộ dữ liệu nhạy cảm.
            logger.warn("Không gửi được email xác thực đăng ký; loại lỗi={}", exception.getClass().getSimpleName());
        }
    }
}
