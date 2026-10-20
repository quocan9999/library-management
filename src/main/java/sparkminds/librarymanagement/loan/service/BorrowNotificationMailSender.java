package sparkminds.librarymanagement.loan.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository.Delivery;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository;

@Component
public class BorrowNotificationMailSender {
    private final JavaMailSender sender;
    private final String from;
    private final BorrowNotificationRepository notifications;

    public BorrowNotificationMailSender(JavaMailSender sender, @Value("${app.mail.from}") String from,
            BorrowNotificationRepository notifications) {
        this.sender = sender;
        this.from = from;
        this.notifications = notifications;
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
        String books = delivery.kind() == sparkminds.librarymanagement.loan.entity.NotificationKind.READY_FOR_PICKUP
                && delivery.key() != null && delivery.key().startsWith("ready-batch:")
                ? String.join("\n- ", notifications.readyBatchTitles(delivery)) : delivery.bookTitle();
        String pickupInvitation = delivery.kind() == sparkminds.librarymanagement.loan.entity.NotificationKind.READY_FOR_PICKUP
                ? "\nVui lòng đến thư viện nhận các sách trên trước hạn nhận, mang theo giấy tờ xác minh danh tính và mã QR của yêu cầu." : "";
        message.setText(subject + "\nMã yêu cầu: " + delivery.loanCode() + "\nSách:\n- " + books
                + timing + pickupInvitation + "\nVui lòng đăng nhập hệ thống để xem toàn bộ yêu cầu và trạng thái hiện hành.");
        sender.send(message);
    }
}
