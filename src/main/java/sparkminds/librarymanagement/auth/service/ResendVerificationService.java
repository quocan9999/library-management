package sparkminds.librarymanagement.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.stereotype.Service;

@Service
public class ResendVerificationService {

    private static final Logger logger = LoggerFactory.getLogger(ResendVerificationService.class);

    private final InMemoryVerificationRateLimiter rateLimiter;
    private final ResendVerificationTransactionService transactionService;
    private final RegistrationMailSender mailSender;

    public ResendVerificationService(
            InMemoryVerificationRateLimiter rateLimiter,
            ResendVerificationTransactionService transactionService,
            RegistrationMailSender mailSender
    ) {
        this.rateLimiter = rateLimiter;
        this.transactionService = transactionService;
        this.mailSender = mailSender;
    }

    /** Giữ thao tác cùng email tuần tự nhưng chỉ mở transaction DB trong lúc ghi/khôi phục ứng viên. */
    public void resend(String email) {
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
                logger.warn("Không gửi được email xác thực; loại lỗi={}", mailException.getClass().getSimpleName());
                try {
                    transactionService.removeUnsentCandidate(candidate);
                } catch (RuntimeException compensationException) {
                    logger.error("Không khôi phục được token xác thực sau lỗi SMTP; loại lỗi={}",
                            compensationException.getClass().getSimpleName());
                }
            }
        }
    }
}
