package sparkminds.librarymanagement.profile.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class EmailChangeMailSender {

    private final JavaMailSender mailSender;
    private final String from;

    public EmailChangeMailSender(JavaMailSender mailSender, @Value("${app.mail.from}") String from) {
        this.mailSender = mailSender;
        this.from = from;
    }

    public void sendCode(String email, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(email);
        message.setSubject("Mã xác thực thay đổi email tài khoản thư viện");
        message.setText("Mã xác thực thay đổi email của bạn là: " + code + "\n\n"
                + "Mã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu thay đổi email, vui lòng bỏ qua thư này.");
        mailSender.send(message);
    }
}
