package sparkminds.librarymanagement.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class RegistrationMailSender {

    private final JavaMailSender mailSender;
    private final String from;
    private final String frontendBaseUrl;

    public RegistrationMailSender(
            JavaMailSender mailSender,
            @Value("${app.mail.from}") String from,
            @Value("${app.frontend.base-url}") String frontendBaseUrl
    ) {
        this.mailSender = mailSender;
        this.from = from;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public void sendVerificationEmail(String email, String rawToken) {
        String verificationLink = buildVerificationLink(rawToken);
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("Xác thực email đăng ký thư viện");
        message.setText("Chào bạn,\n\n"
                + "Vui lòng xác thực địa chỉ email bằng liên kết sau. Liên kết có hiệu lực trong 30 phút:\n"
                + verificationLink + "\n\n"
                + "Nếu bạn không yêu cầu đăng ký tài khoản, vui lòng bỏ qua email này.");
        mailSender.send(message);
    }

    String buildVerificationLink(String rawToken) {
        String normalizedBaseUrl = frontendBaseUrl.replaceFirst("/+$", "");
        // Mở rộng token như biến URI để các ký tự đặc biệt luôn được mã hóa trong query parameter.
        return UriComponentsBuilder.fromUriString(normalizedBaseUrl)
                .path("/verify-email")
                .queryParam("token", "{token}")
                .encode()
                .buildAndExpand(rawToken)
                .toUriString();
    }
}
