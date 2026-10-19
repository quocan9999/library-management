package sparkminds.librarymanagement.loan.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository.Delivery;

@Component
public class BorrowNotificationMailSender {
    private final JavaMailSender sender;
    private final String from;

    public BorrowNotificationMailSender(JavaMailSender sender, @Value("${app.mail.from}") String from) {
        this.sender = sender;
        this.from = from;
    }

    public void send(Delivery delivery) {
        String subject = switch (delivery.kind()) {
            case REQUEST_CREATED -> "Đã tiếp nhận yêu cầu mượn sách";
            case READY_FOR_PICKUP -> "Sách đã sẵn sàng nhận tại thư viện";
            case CANCELLED -> "Đã hủy sách trong yêu cầu mượn";
            case EXPIRED -> "Sách đã hết hạn nhận tại thư viện";
            case HANDOVER_COMPLETED -> "Đã bàn giao sách tại thư viện";
            case DUE_REMINDER_THREE_DAYS, DUE_REMINDER_TODAY, OVERDUE_REMINDER_FIRST_DAY -> "Nhắc hạn trả sách thư viện";
        };
        String timing = delivery.isReminder() ? "\nNgày đến hạn hiện hành: " + delivery.dueDate()
                : delivery.kind() == sparkminds.librarymanagement.loan.entity.NotificationKind.READY_FOR_PICKUP
                ? "\nHạn nhận (UTC): " + delivery.pickupExpiresAt() : "";
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(delivery.email());
        message.setSubject(subject);
        message.setText(subject + "\nMã yêu cầu: " + delivery.loanCode() + "\nSách: " + delivery.bookTitle()
                + timing + "\nVui lòng đăng nhập hệ thống để xem toàn bộ yêu cầu và trạng thái hiện hành.");
        sender.send(message);
    }
}
