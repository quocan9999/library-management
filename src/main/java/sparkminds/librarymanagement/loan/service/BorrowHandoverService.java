package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.HandoverRequest;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanOrigin;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;
import sparkminds.librarymanagement.loan.entity.NotificationKind;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BorrowHandoverService {
    private final BorrowRetryExecutor retryExecutor;
    private final StaffBorrowLockService locks;
    private final LoanItemRepository itemRepository;
    private final BorrowAuditService auditService;
    private final LoanAggregateService aggregateService;
    private final StaffBorrowQueryService queryService;
    private final Clock clock;

    public StaffBorrowResponse handover(Integer actorId, String code, HandoverRequest request) {
        if (!Boolean.TRUE.equals(request.identityVerified())) {
            throw error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_ERROR", "Nhân viên phải xác nhận đã đối chiếu danh tính thành viên");
        }
        return retryExecutor.execute(() -> handoverAttempt(actorId, code, request));
    }

    /** Kiểm tra toàn bộ tập READY và phí trước mutation; thu phí, giao sách, audit cùng một transaction retry. */
    private StaffBorrowResponse handoverAttempt(Integer actorId, String code, HandoverRequest request) {
        var actor = locks.actor(actorId, "borrow:handover", "borrow:fee-confirm");
        var context = locks.lock(code, true);
        var loan = context.loan();
        var ready = context.items().stream().filter(item -> item.getStatus() == LoanItemStatus.READY_FOR_PICKUP).toList();
        if (ready.isEmpty()) {
            String codeError = context.items().stream().anyMatch(item -> item.getBorrowedAt() != null)
                    ? "BORROW_ALREADY_HANDED_OVER" : "BORROW_ITEM_NOT_READY";
            throw error(HttpStatus.CONFLICT, codeError, "Không còn sách sẵn sàng để bàn giao");
        }
        if (loan.getVersion() != request.expectedLoanVersion()) {
            throw error(HttpStatus.CONFLICT, "BORROW_VERSION_CONFLICT", "Yêu cầu đã thay đổi, hãy tải lại trước khi thu phí");
        }
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (ready.stream().anyMatch(item -> !now.isBefore(item.getPickupExpiresAt()))) {
            throw error(HttpStatus.CONFLICT, "BORROW_PICKUP_EXPIRED", "Có sách đã hết hạn nhận tại quầy");
        }
        int memberId = loan.getMember().getId();
        if (itemRepository.existsByLoanMemberIdAndStatusAndDueDateBefore(memberId, LoanItemStatus.BORROWED, LocalDate.now(clock))
                || itemRepository.hasUnpaidLateFee(memberId)) {
            throw error(HttpStatus.CONFLICT, "BORROW_OUTSTANDING_OBLIGATION", "Thành viên còn sách quá hạn hoặc phí trễ chưa giải quyết");
        }
        Map<Integer, BigDecimal> payments;
        if (loan.getOrigin() == LoanOrigin.COUNTER) {
            payments = validatedCounterPayments(ready, request);
        } else {
            validateOnlinePayment(loan.getPaymentStatus(), ready, request);
            payments = Map.of();
        }
        if (loan.getBorrowedAt() == null) loan.setBorrowedAt(now);
        if (loan.getOrigin() == LoanOrigin.COUNTER) {
            BigDecimal collectedAmount = payments.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            if (collectedAmount.signum() > 0) {
                loan.setPaymentAmount(loan.getPaymentAmount().add(collectedAmount));
                loan.setPaymentStatus(LoanPaymentStatus.PAID);
                loan.setPaymentMethod(sparkminds.librarymanagement.loan.entity.LoanPaymentMethod.COUNTER);
                loan.setPaidAt(now);
                loan.setPaymentExpiresAt(null);
            }
        }
        for (int index = 0; index < ready.size(); index++) {
            var item = ready.get(index);
            if (loan.getOrigin() == LoanOrigin.COUNTER) {
                item.setPaidBorrowFee(payments.get(item.getId()));
                item.setBorrowFeePaidAt(now);
                item.setBorrowFeeConfirmedByAccount(actor);
            }
            item.setBorrowedAt(now);
            item.setDueDate(now.toLocalDate().plusDays(14));
            item.setStatus(LoanItemStatus.BORROWED);
            // Một ý định email cho đợt giao; khoản0 vẫn có đủ thời điểm và staff xác nhận như khoản có phí.
            auditService.append(item, LoanItemStatus.READY_FOR_PICKUP, LoanItemEventReason.HANDOVER_COMPLETED, actor,
                    index == 0 ? NotificationKind.HANDOVER_COMPLETED : null,
                    index == 0 ? "item:" + item.getId() + ":handover" : null);
        }
        aggregateService.refresh(Set.of(loan.getId()));
        return queryService.detail(code);
    }

    private Map<Integer, BigDecimal> validatedCounterPayments(List<LoanItem> ready, HandoverRequest request) {
        var submittedIds = request.items().stream().map(HandoverRequest.PaymentItem::loanItemId).toList();
        if (new HashSet<>(submittedIds).size() != submittedIds.size()) {
            throw error(HttpStatus.UNPROCESSABLE_ENTITY, "BORROW_INVALID_HANDOVER_SET", "Danh sách thu phí không được lặp sách");
        }
        var readyIds = ready.stream().map(item -> item.getId()).collect(Collectors.toSet());
        if (!readyIds.equals(new HashSet<>(submittedIds))) {
            throw error(HttpStatus.CONFLICT, "BORROW_INVALID_HANDOVER_SET", "Phải bàn giao toàn bộ sách READY còn lại của yêu cầu");
        }
        var payments = request.items().stream().collect(Collectors.toMap(HandoverRequest.PaymentItem::loanItemId,
                HandoverRequest.PaymentItem::collectedBorrowFee));
        for (var item : ready) {
            if (item.getBorrowFee().compareTo(payments.get(item.getId())) != 0) {
                throw error(HttpStatus.UNPROCESSABLE_ENTITY, "BORROW_FEE_MISMATCH", "Số tiền xác nhận phải khớp phí mượn đã chốt của từng sách");
            }
        }
        return payments;
    }

    private void validateOnlinePayment(LoanPaymentStatus paymentStatus, List<LoanItem> ready,
                                       HandoverRequest request) {
        if (paymentStatus != LoanPaymentStatus.PAID) {
            throw error(HttpStatus.CONFLICT, "BORROW_PAYMENT_REQUIRED", "Yêu cầu phải thanh toán trực tuyến trước khi bàn giao");
        }
        if (!request.items().isEmpty() || ready.stream().anyMatch(item -> item.getPaidBorrowFee() == null
                || item.getPaidBorrowFee().compareTo(item.getBorrowFee()) != 0 || item.getBorrowFeePaidAt() == null)) {
            throw error(HttpStatus.CONFLICT, "BORROW_PAYMENT_RECORD_MISSING", "Không tìm thấy xác nhận thanh toán trực tuyến cho toàn bộ sách READY");
        }
    }

    private BusinessException error(HttpStatus status, String code, String message) {
        return new BusinessException(status, code, message);
    }
}
