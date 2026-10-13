package sparkminds.librarymanagement.auth.service;

import lombok.extern.slf4j.Slf4j;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
@Slf4j
public class RegistrationMailListener {

    private final RegistrationMailSender mailSender;
    private final InMemoryVerificationRateLimiter rateLimiter;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void sendAfterCommit(RegistrationMailRequested event) {
        try (var permit = rateLimiter.lockEmailOperation(event.email())) {
            if (!permit.canSendEmail()) {
                log.warn("Đã bỏ qua email xác thực đăng ký do giới hạn gửi; loại lỗi=EmailRateLimit");
                return;
            }
            mailSender.sendVerificationEmail(event.email(), event.rawToken());
            permit.recordSuccessfulSend();
        } catch (Exception exception) {
            // SMTP lỗi không được đổi kết quả đăng ký; log duy nhất tên lớp lỗi để tránh lộ dữ liệu nhạy cảm.
            log.warn("Không gửi được email xác thực đăng ký; loại lỗi={}", exception.getClass().getSimpleName());
        }
    }
}
