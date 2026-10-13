package sparkminds.librarymanagement.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

@Component
public class PasswordResetMailSender {

    private final JavaMailSender mailSender;
    private final String from;
    private final String frontendBaseUrl;

    public PasswordResetMailSender(
            JavaMailSender mailSender,
            @Value("${app.mail.from}") String from,
            @Value("${app.frontend.base-url}") String frontendBaseUrl
    ) {
        this.mailSender = mailSender;
        this.from = from;
        this.frontendBaseUrl = frontendBaseUrl;
    }

    public void sendResetPasswordEmail(String email, String rawToken) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("Đặt lại mật khẩu tài khoản thư viện");
        message.setText("Chào bạn,\n\n"
                + "Bạn có thể đặt lại mật khẩu trong vòng 30 phút bằng liên kết sau:\n"
                + buildResetLink(rawToken) + "\n\n"
                + "Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.");
        mailSender.send(message);
    }

    String buildResetLink(String rawToken) {
        String normalizedBaseUrl = frontendBaseUrl.replaceFirst("/+$", "");
        return UriComponentsBuilder.fromUriString(normalizedBaseUrl)
                .path("/reset-password")
                .queryParam("token", "{token}")
                .encode()
                .buildAndExpand(rawToken)
                .toUriString();
    }
}
