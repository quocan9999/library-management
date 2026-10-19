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
import sparkminds.librarymanagement.loan.repository.BorrowReadRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemStatusHistoryRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
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
        return responses(List.of(loanRepository.findByPickupReference(reference)
                .orElseThrow(BorrowQueryService::notFound))).get(0);
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
                event.getOccurredAt().toInstant(ZoneOffset.UTC), event.getNote())).toList();
        return PagedResponse.of(content, events.getNumber(), events.getSize(), events.getTotalElements());
    }

    public PagedResponse<StaffBorrowResponse> list(String status, String page, String size, String sort) {
        var filter = BorrowRequestFilter.parse(status);
        var pagination = BorrowPagination.parse(page, size, sort, "createdAt", Sort.Direction.DESC);
        var loans = loanRepository.findStaffRequests(filter == BorrowRequestFilter.ALL, filter.statuses(), pagination);
        return PagedResponse.of(responses(loans.getContent()), loans.getNumber(), loans.getSize(), loans.getTotalElements());
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
                    new StaffBorrowResponse.MemberIdentity(member.getId(), member.getMemberCode(), member.getFullName()),
                    responses, warnings);
        }).toList();
    }
}
