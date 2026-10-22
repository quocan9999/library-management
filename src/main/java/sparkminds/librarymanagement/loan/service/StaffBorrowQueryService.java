package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import sparkminds.librarymanagement.common.api.PagedResponse;
import sparkminds.librarymanagement.loan.dto.BorrowItemResponse;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.dto.StaffBorrowHistoryResponse;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.entity.LoanPaymentStatus;
import sparkminds.librarymanagement.loan.repository.BorrowReadRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemStatusHistoryRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import sparkminds.librarymanagement.common.api.BusinessException;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StaffBorrowQueryService {
    private final LoanRepository loanRepository;
    private final LoanItemRepository itemRepository;
    private final BorrowReadRepository readRepository;
    private final LoanItemStatusHistoryRepository historyRepository;
    private final Clock clock;

    public StaffBorrowResponse pickup(String reference) {
        var loan = loanRepository.findByPickupReference(reference).orElseThrow(BorrowQueryService::notFound);
        if (loan.getPaymentStatus() == LoanPaymentStatus.PENDING) throw BorrowQueryService.notFound();
        return responses(List.of(loan)).get(0);
    }

    public StaffBorrowResponse detail(String code) {
        return responses(List.of(loanRepository.findByLoanCode(code).orElseThrow(BorrowQueryService::notFound))).get(0);
    }

    public PagedResponse<StaffBorrowHistoryResponse> history(String code, String page, String size, String sort) {
        var loan = loanRepository.findByLoanCode(code).orElseThrow(BorrowQueryService::notFound);
        var pagination = BorrowPagination.parse(page, size, sort, "occurredAt", Sort.Direction.ASC);
        var events = historyRepository.findByLoanItemLoanId(loan.getId(), pagination);
        var content = events.getContent().stream().map(event -> new StaffBorrowHistoryResponse(event.getId(),
                event.getLoanItem().getId(), event.getFromStatus(), event.getToStatus(), event.getReasonCode(),
                event.getActorAccount() == null ? null : event.getActorAccount().getId(), event.getActorRoleCode(),
                event.getOccurredAt().toInstant(ZoneOffset.UTC), event.getNote(), event.getNotificationKind(),
                event.getNotificationState(), event.getNotificationAttempts(),
                event.getNotificationNextAttemptAt() == null ? null : event.getNotificationNextAttemptAt().toInstant(ZoneOffset.UTC),
                event.getNotificationSentAt() == null ? null : event.getNotificationSentAt().toInstant(ZoneOffset.UTC),
                event.getNotificationLastErrorCode())).toList();
        return PagedResponse.of(content, events.getNumber(), events.getSize(), events.getTotalElements());
    }

    public PagedResponse<StaffBorrowResponse> list(String status, String page, String size, String sort) {
        return list(status, page, size, sort, null);
    }

    public PagedResponse<StaffBorrowResponse> list(String status, String page, String size, String sort, String q) {
        var filter = BorrowRequestFilter.parse(status);
        var pagination = staffPagination(page, size, sort);
        String search = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (search.length() > 200) throw invalidSearch();
        String pattern = "%" + search.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
        var results = loanRepository.searchStaffRequests(filter == BorrowRequestFilter.ALL,
                filter.statuses(), search, pattern, pagination);
        var loans = results.getContent().stream().map(row -> (Loan) row[0]).toList();
        return PagedResponse.of(responses(loans), results.getNumber(), results.getSize(), results.getTotalElements());
    }

    private PageRequest staffPagination(String page, String size, String sort) {
        var pagination = BorrowPagination.parse(page, size, null, "createdAt", Sort.Direction.DESC);
        if (sort == null || sort.isBlank()) return pagination;
        var fields = Map.of("loanCode", "loanCode", "memberName", "member.fullName",
                "itemCount", "itemCount", "createdAt", "createdAt");
        String[] parts = sort.split(",", -1);
        if (parts.length != 2 || !fields.containsKey(parts[0].trim())) throw invalidSearch();
        try {
            var direction = Sort.Direction.fromString(parts[1].trim());
            // Chỉ dùng field trong whitelist; id cố định thứ tự khi nhiều yêu cầu có cùng giá trị.
            var ordering = Sort.by(direction, fields.get(parts[0].trim())).and(Sort.by(direction, "id"));
            return PageRequest.of(pagination.getPageNumber(), pagination.getPageSize(), ordering);
        } catch (IllegalArgumentException exception) {
            throw invalidSearch();
        }
    }

    private BusinessException invalidSearch() {
        return new BusinessException(HttpStatus.BAD_REQUEST, "INVALID_REQUEST_PARAMETER",
                "Tham số tìm kiếm hoặc sắp xếp không hợp lệ");
    }

    /** Đọc cả trang bằng batch; Member chỉ có mã/tên để đối chiếu, không trả email, điện thoại hay tài khoản. */
    private List<StaffBorrowResponse> responses(List<Loan> loans) {
        if (loans.isEmpty()) return List.of();
        var items = itemRepository.findWithBookByLoanIdIn(loans.stream().map(Loan::getId).toList());
        var positions = readRepository.queuePositions(items.stream().filter(item -> item.getStatus() == LoanItemStatus.WAITLISTED)
                .map(LoanItem::getId).toList());
        var byLoan = items.stream().collect(Collectors.groupingBy(item -> item.getLoan().getId()));
        LocalDateTime cutoff = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC).minusHours(24);
        return loans.stream().map(loan -> {
            var ownedItems = byLoan.getOrDefault(loan.getId(), List.of());
            var responses = ownedItems.stream().map(item -> {
                var position = positions.get(item.getId());
                return BorrowItemResponse.from(item, position == null ? null : position.position(),
                        position == null ? null : position.total());
            }).toList();
            // PREPARING chỉ đổi updatedAt khi bắt đầu chuẩn bị; đây là cảnh báo, không tự hủy hoặc thay đổi deadline.
            var warnings = ownedItems.stream().filter(item -> item.getStatus() == LoanItemStatus.PREPARING
                    && item.getUpdatedAt().isBefore(cutoff)).map(LoanItem::getId).toList();
            var member = loan.getMember();
            return new StaffBorrowResponse(loan.getLoanCode(), loan.getPickupReference(), loan.getStatus(),
                    loan.getCreatedAt().toInstant(ZoneOffset.UTC), loan.getVersion(),
                    loan.getOrigin(), loan.getPaymentStatus(), loan.getPaymentAmount(),
                    loan.getPaymentExpiresAt() == null ? null : loan.getPaymentExpiresAt().toInstant(ZoneOffset.UTC),
                    new StaffBorrowResponse.MemberIdentity(member.getId(), member.getMemberCode(), member.getFullName()),
                    responses, warnings);
        }).toList();
    }
}
