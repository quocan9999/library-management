package sparkminds.librarymanagement.loan.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import sparkminds.librarymanagement.auth.entity.Account;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.dto.ReturnBorrowItemsRequest;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemEventReason;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanStatus;
import sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.function.Supplier;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StaffBorrowReturnServiceTests {

    @Mock
    private BorrowRetryExecutor retryExecutor;

    @Mock
    private StaffBorrowLockService locks;

    @Mock
    private LoanItemRepository itemRepository;

    @Mock
    private BorrowAuditService auditService;

    @Mock
    private LoanAggregateService aggregateService;

    @Mock
    private StaffBorrowQueryService queryService;

    @Mock
    private BorrowNotificationRepository notificationRepository;

    private Clock clock;
    private StaffBorrowReturnService service;

    private final Instant fixedNow = Instant.parse("2026-10-27T10:00:00Z");

    @BeforeEach
    void setUp() {
        clock = Clock.fixed(fixedNow, ZoneOffset.UTC);
        service = new StaffBorrowReturnService(
                retryExecutor, locks, itemRepository, auditService,
                aggregateService, queryService, notificationRepository, clock
        );
    }

    @Test
    @DisplayName("Ném lỗi 422 khi chưa xác nhận nhận sách vật lý tại quầy")
    void returnItems_throwsWhenPhysicalBookNotReceived() {
        var request = new ReturnBorrowItemsRequest(List.of(1), false, false);

        assertThatThrownBy(() -> service.returnItems(99, "L000001", request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("sách vật lý");

        verifyNoInteractions(retryExecutor);
    }

    @Test
    @DisplayName("Ném lỗi 404 khi sách không thuộc phiếu mượn")
    void returnItems_throwsWhenItemNotFound() {
        var request = new ReturnBorrowItemsRequest(List.of(999), true, false);
        Account actor = new Account();
        actor.setId(99);

        Loan loan = new Loan();
        loan.setId(1);
        loan.setLoanCode("L000001");

        when(retryExecutor.execute(any())).thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(0)).get());
        when(locks.actor(99, "borrow:return")).thenReturn(actor);
        when(locks.lock("L000001", false)).thenReturn(new StaffBorrowLockService.Context(loan, List.of()));

        assertThatThrownBy(() -> service.returnItems(99, "L000001", request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Không tìm thấy sách");
    }

    @Test
    @DisplayName("Ném lỗi 409 khi sách không ở trạng thái BORROWED")
    void returnItems_throwsWhenItemNotBorrowed() {
        var request = new ReturnBorrowItemsRequest(List.of(1), true, false);
        Account actor = new Account();
        actor.setId(99);

        Loan loan = new Loan();
        loan.setId(1);
        loan.setLoanCode("L000001");

        Book book = new Book();
        book.setId(10);
        book.setTitle("Sách mẫu");

        LoanItem item = new LoanItem();
        item.setId(1);
        item.setBook(book);
        item.setStatus(LoanItemStatus.READY_FOR_PICKUP);

        when(retryExecutor.execute(any())).thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(0)).get());
        when(locks.actor(99, "borrow:return")).thenReturn(actor);
        when(locks.lock("L000001", false)).thenReturn(new StaffBorrowLockService.Context(loan, List.of(item)));

        assertThatThrownBy(() -> service.returnItems(99, "L000001", request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("không ở trạng thái đang mượn");
    }

    @Test
    @DisplayName("Ném lỗi 422 khi sách quá hạn mà chưa xác nhận thu phí trễ")
    void returnItems_throwsWhenOverdueWithoutLateFeeConfirmation() {
        var request = new ReturnBorrowItemsRequest(List.of(1), true, false);
        Account actor = new Account();
        actor.setId(99);

        Loan loan = new Loan();
        loan.setId(1);
        loan.setLoanCode("L000001");

        Book book = new Book();
        book.setId(10);
        book.setTitle("Sách quá hạn");

        LoanItem item = new LoanItem();
        item.setId(1);
        item.setBook(book);
        item.setStatus(LoanItemStatus.BORROWED);
        item.setDueDate(LocalDate.parse("2026-10-20")); // Overdue 7 days from 2026-10-27
        item.setLateFeePerDay(new BigDecimal("5000"));

        when(retryExecutor.execute(any())).thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(0)).get());
        when(locks.actor(99, "borrow:return")).thenReturn(actor);
        when(locks.lock("L000001", false)).thenReturn(new StaffBorrowLockService.Context(loan, List.of(item)));

        assertThatThrownBy(() -> service.returnItems(99, "L000001", request))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("phạt trễ hạn");
    }

    @Test
    @DisplayName("Trả sách đúng hạn thành công: cộng tồn kho, không tính phí trễ")
    void returnItems_successfulOnTimeReturn() {
        var request = new ReturnBorrowItemsRequest(List.of(1), true, false);
        Account actor = new Account();
        actor.setId(99);

        Loan loan = new Loan();
        loan.setId(1);
        loan.setLoanCode("L000001");

        Book book = new Book();
        book.setId(10);
        book.setTitle("Sách đúng hạn");
        book.setAvailableQuantity(2);

        LoanItem item = new LoanItem();
        item.setId(1);
        item.setBook(book);
        item.setStatus(LoanItemStatus.BORROWED);
        item.setDueDate(LocalDate.parse("2026-10-30")); // Not overdue
        item.setLateFeePerDay(new BigDecimal("5000"));

        when(retryExecutor.execute(any())).thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(0)).get());
        when(locks.actor(99, "borrow:return")).thenReturn(actor);
        when(locks.lock("L000001", false)).thenReturn(new StaffBorrowLockService.Context(loan, List.of(item)));
        StaffBorrowResponse expectedResponse = mock(StaffBorrowResponse.class);
        when(queryService.detail("L000001")).thenReturn(expectedResponse);

        StaffBorrowResponse actual = service.returnItems(99, "L000001", request);

        assertThat(actual).isSameAs(expectedResponse);
        assertThat(item.getStatus()).isEqualTo(LoanItemStatus.RETURNED);
        assertThat(item.getReturnedAt()).isEqualTo(fixedNow.atZone(ZoneOffset.UTC).toLocalDateTime());
        assertThat(item.getLateFee()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(book.getAvailableQuantity()).isEqualTo(3);

        verify(notificationRepository).supersedeOldReminders(1, item.getDueDate());
        verify(auditService).append(item, LoanItemStatus.BORROWED, LoanItemEventReason.RETURN_COMPLETED, actor, null, null);
        verify(aggregateService).refresh(Set.of(1));
    }

    @Test
    @DisplayName("Trả sách quá hạn có xác nhận thu phí: tính đúng tiền phạt, ghi nhận actor thu phạt")
    void returnItems_successfulOverdueReturnWithLateFeeConfirmation() {
        var request = new ReturnBorrowItemsRequest(List.of(1), true, true);
        Account actor = new Account();
        actor.setId(99);

        Loan loan = new Loan();
        loan.setId(1);
        loan.setLoanCode("L000001");

        Book book = new Book();
        book.setId(10);
        book.setTitle("Sách quá hạn");
        book.setAvailableQuantity(1);

        LoanItem item = new LoanItem();
        item.setId(1);
        item.setBook(book);
        item.setStatus(LoanItemStatus.BORROWED);
        item.setDueDate(LocalDate.parse("2026-10-24")); // Overdue 3 days from 2026-10-27
        item.setLateFeePerDay(new BigDecimal("5000"));

        when(retryExecutor.execute(any())).thenAnswer(invocation -> ((Supplier<?>) invocation.getArgument(0)).get());
        when(locks.actor(99, "borrow:return")).thenReturn(actor);
        when(locks.lock("L000001", false)).thenReturn(new StaffBorrowLockService.Context(loan, List.of(item)));
        StaffBorrowResponse expectedResponse = mock(StaffBorrowResponse.class);
        when(queryService.detail("L000001")).thenReturn(expectedResponse);

        StaffBorrowResponse actual = service.returnItems(99, "L000001", request);

        assertThat(actual).isSameAs(expectedResponse);
        assertThat(item.getStatus()).isEqualTo(LoanItemStatus.RETURNED);
        assertThat(item.getReturnedAt()).isEqualTo(fixedNow.atZone(ZoneOffset.UTC).toLocalDateTime());
        // 3 days * 5000 = 15000
        assertThat(item.getLateFee()).isEqualByComparingTo(new BigDecimal("15000"));
        assertThat(item.getLateFeePaidAt()).isEqualTo(fixedNow.atZone(ZoneOffset.UTC).toLocalDateTime());
        assertThat(item.getLateFeePaidByAccount()).isEqualTo(actor);
        assertThat(book.getAvailableQuantity()).isEqualTo(2);

        verify(notificationRepository).supersedeOldReminders(1, item.getDueDate());
        verify(auditService).append(item, LoanItemStatus.BORROWED, LoanItemEventReason.RETURN_COMPLETED, actor, null, null);
        verify(aggregateService).refresh(Set.of(1));
    }
}
