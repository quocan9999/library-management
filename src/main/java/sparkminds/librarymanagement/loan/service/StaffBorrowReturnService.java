package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.ReportLostItemsRequest;
import sparkminds.librarymanagement.loan.dto.ReturnBorrowItemsRequest;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * Service xử lý tiếp nhận trả sách, báo mất sách và xác nhận hoàn tiền tại quầy.
 * Bắt buộc sử dụng Lombok (@Slf4j, @RequiredArgsConstructor) và comment chi tiết bằng tiếng Việt.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StaffBorrowReturnService {

    private final BorrowRetryExecutor retryExecutor;
    private final StaffBorrowLockService locks;
    private final LoanItemRepository itemRepository;
    private final BorrowAuditService auditService;
    private final LoanAggregateService aggregateService;
    private final StaffBorrowQueryService queryService;
    private final BorrowNotificationRepository notificationRepository;
    private final Clock clock;

    /**
     * Tiếp nhận trả sách nguyên vẹn tại quầy.
     * Yêu cầu xác nhận nhận sách vật lý, xác nhận hoàn cọc và thu phí phạt trễ (nếu có).
     */
    public StaffBorrowResponse returnItems(Integer actorId, String code, ReturnBorrowItemsRequest request) {
        if (!Boolean.TRUE.equals(request.physicalBookReceived())) {
            throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "Nhân viên phải xác nhận đã nhận sách vật lý từ độc giả tại quầy");
        }
        if (!Boolean.TRUE.equals(request.depositRefunded())) {
            throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "Nhân viên phải xác nhận đã hoàn trả tiền cọc cho độc giả tại quầy");
        }
        return retryExecutor.execute(() -> returnAttempt(actorId, code, request));
    }

    private StaffBorrowResponse returnAttempt(Integer actorId, String code, ReturnBorrowItemsRequest request) {
        var actor = locks.actor(actorId, "borrow:return");
        var context = locks.lock(code, false);

        List<LoanItem> targetItems = new ArrayList<>();
        for (Integer itemId : request.itemIds()) {
            var item = context.items().stream()
                    .filter(i -> i.getId().equals(itemId))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "BORROW_ITEM_NOT_FOUND",
                            "Không tìm thấy sách trong yêu cầu mượn"));
            if (item.getStatus() != LoanItemStatus.BORROWED) {
                throw new BusinessException(HttpStatus.CONFLICT, "BORROW_ITEM_NOT_BORROWED",
                        "Sách '" + item.getBook().getTitle() + "' không ở trạng thái đang mượn");
            }
            targetItems.add(item);
        }

        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        LocalDate today = now.toLocalDate();

        BigDecimal totalLateFee = BigDecimal.ZERO;
        for (LoanItem item : targetItems) {
            if (today.isAfter(item.getDueDate())) {
                long overdueDays = ChronoUnit.DAYS.between(item.getDueDate(), today);
                BigDecimal fee = item.getLateFeePerDay().multiply(BigDecimal.valueOf(overdueDays));
                totalLateFee = totalLateFee.add(fee);
            }
        }

        if (totalLateFee.signum() > 0 && !Boolean.TRUE.equals(request.lateFeeCollected())) {
            throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "Phải xác nhận đã thu đủ tiền phạt trễ hạn tại quầy");
        }

        for (LoanItem item : targetItems) {
            item.setStatus(LoanItemStatus.RETURNED);
            item.setReturnedAt(now);

            // Ghi nhận hoàn cọc đủ 100% khi sách được trả nguyên vẹn
            item.setDepositRefundedAmount(item.getDepositAmount());
            item.setDepositRefundedAt(now);
            item.setDepositRefundedByAccount(actor);

            if (today.isAfter(item.getDueDate())) {
                long overdueDays = ChronoUnit.DAYS.between(item.getDueDate(), today);
                BigDecimal lateFee = item.getLateFeePerDay().multiply(BigDecimal.valueOf(overdueDays));
                item.setLateFee(lateFee);
                item.setLateFeePaidAt(now);
                item.setLateFeePaidByAccount(actor);
            } else {
                item.setLateFee(BigDecimal.ZERO);
            }

            var book = item.getBook();
            book.setAvailableQuantity(book.getAvailableQuantity() + 1);

            notificationRepository.supersedeOldReminders(item.getId(), item.getDueDate());
            auditService.append(item, LoanItemStatus.BORROWED, LoanItemEventReason.RETURN_COMPLETED, actor, null, null);
        }

        aggregateService.refresh(Set.of(context.loan().getId()));
        log.info("Returned {} items for loan {} by actor {}", targetItems.size(), code, actor.getId());
        return queryService.detail(code);
    }

    /**
     * Báo mất sách tại quầy.
     * Chuyển trạng thái sang LOST, tịch thu tiền cọc, và khấu trừ 1 cuốn khỏi tổng số lượng sách (total_quantity - 1).
     */
    public StaffBorrowResponse reportLostItems(Integer actorId, String code, ReportLostItemsRequest request) {
        return retryExecutor.execute(() -> reportLostAttempt(actorId, code, request));
    }

    private StaffBorrowResponse reportLostAttempt(Integer actorId, String code, ReportLostItemsRequest request) {
        var actor = locks.actor(actorId, "borrow:return");
        var context = locks.lock(code, false);

        List<LoanItem> targetItems = new ArrayList<>();
        for (Integer itemId : request.itemIds()) {
            var item = context.items().stream()
                    .filter(i -> i.getId().equals(itemId))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "BORROW_ITEM_NOT_FOUND",
                            "Không tìm thấy sách trong yêu cầu mượn"));
            if (item.getStatus() != LoanItemStatus.BORROWED) {
                throw new BusinessException(HttpStatus.CONFLICT, "BORROW_ITEM_NOT_BORROWED",
                        "Sách '" + item.getBook().getTitle() + "' không ở trạng thái đang mượn");
            }
            targetItems.add(item);
        }

        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);

        for (LoanItem item : targetItems) {
            item.setStatus(LoanItemStatus.LOST);
            item.setDepositForfeitedAt(now);
            item.setDepositRefundedAmount(BigDecimal.ZERO);

            // Giảm tổng số lượng sách trong kho vĩnh viễn (không cộng lại availableQuantity vì sách đã mất)
            var book = item.getBook();
            book.setTotalQuantity(Math.max(0, book.getTotalQuantity() - 1));

            notificationRepository.supersedeOldReminders(item.getId(), item.getDueDate());
            auditService.append(item, LoanItemStatus.BORROWED, LoanItemEventReason.LOST_REPORTED, actor, null, null);
        }

        aggregateService.refresh(Set.of(context.loan().getId()));
        log.info("Reported {} lost items for loan {} by actor {}", targetItems.size(), code, actor.getId());
        return queryService.detail(code);
    }

    /**
     * Xác nhận hoàn tiền tại quầy cho đơn đã thanh toán online bị hủy hoặc hết hạn lấy sách.
     */
    public StaffBorrowResponse confirmOfflineRefund(Integer actorId, String code) {
        return retryExecutor.execute(() -> confirmOfflineRefundAttempt(actorId, code));
    }

    private StaffBorrowResponse confirmOfflineRefundAttempt(Integer actorId, String code) {
        var actor = locks.actor(actorId, "borrow:return");
        var context = locks.lock(code, true);
        Loan loan = context.loan();

        if (loan.getPaymentStatus() != LoanPaymentStatus.PAID || loan.getPaidAt() == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "BORROW_REFUND_NOT_PAID",
                    "Đơn mượn chưa phát sinh thanh toán để hoàn tiền");
        }
        if (loan.getRefundedAt() != null) {
            throw new BusinessException(HttpStatus.CONFLICT, "BORROW_ALREADY_REFUNDED",
                    "Khoản thanh toán đã được hoàn trả trước đó");
        }
        boolean hasActiveItems = context.items().stream().anyMatch(item -> item.getStatus().isActive());
        if (hasActiveItems) {
            throw new BusinessException(HttpStatus.CONFLICT, "BORROW_STILL_ACTIVE",
                    "Đơn mượn vẫn còn sách đang hoạt động, không thể hoàn tiền toàn bộ đơn");
        }

        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        loan.setRefundedAmount(loan.getPaymentAmount());
        loan.setRefundedAt(now);
        loan.setRefundedByAccount(actor);

        log.info("Confirmed offline refund of {} for loan {} by actor {}", loan.getRefundedAmount(), code, actor.getId());
        return queryService.detail(code);
    }
}
