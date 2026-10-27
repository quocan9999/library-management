package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.ReturnBorrowItemsRequest;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
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

    public StaffBorrowResponse returnItems(Integer actorId, String code, ReturnBorrowItemsRequest request) {
        if (!Boolean.TRUE.equals(request.physicalBookReceived())) {
            throw new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR",
                    "Nhân viên phải xác nhận đã nhận sách vật lý từ độc giả tại quầy");
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
}
