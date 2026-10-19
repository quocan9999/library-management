package sparkminds.librarymanagement.loan.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import sparkminds.librarymanagement.loan.repository.BorrowReadRepository;
import sparkminds.librarymanagement.loan.repository.BorrowReadRepository.QueuePosition;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.Sort;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.common.api.PagedResponse;
import sparkminds.librarymanagement.loan.dto.BorrowRequestSummaryResponse;
import sparkminds.librarymanagement.loan.dto.BorrowHistoryResponse;
import sparkminds.librarymanagement.loan.dto.BorrowItemResponse;
import sparkminds.librarymanagement.loan.dto.BorrowRequestResponse;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.entity.LoanItemStatus;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;
import sparkminds.librarymanagement.loan.repository.LoanItemStatusHistoryRepository;

import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class BorrowQueryService {

    private final LoanRepository loanRepository;
    private final LoanItemRepository loanItemRepository;
    private final BorrowReadRepository borrowReadRepository;
    private final LoanItemStatusHistoryRepository historyRepository;

    public PagedResponse<BorrowRequestSummaryResponse> listMine(Integer accountId, String status, String page, String size, String sort) {
        var filter = BorrowRequestFilter.parse(status);
        var pagination = BorrowPagination.parse(page, size, sort, "createdAt", Sort.Direction.DESC);
        var loans = loanRepository.findOwnedRequests(accountId, filter == BorrowRequestFilter.ALL, filter.statuses(), pagination);
        if (loans.isEmpty()) return PagedResponse.of(List.of(), pagination.getPageNumber(), pagination.getPageSize(), loans.getTotalElements());
        var ids = loans.getContent().stream().map(loan -> loan.getId()).toList();
        var items = loanItemRepository.findWithBookByLoanIdIn(ids);
        var positions = queuePositions(items);
        var byLoan = items.stream().collect(Collectors.groupingBy(item -> item.getLoan().getId()));
        var content = loans.getContent().stream().map(loan -> {
            var ownedItems = byLoan.get(loan.getId());
            var responses = itemResponses(ownedItems, positions);
            return new BorrowRequestSummaryResponse(loan.getLoanCode(), loan.getPickupReference(), loan.getStatus(),
                    loan.getCreatedAt().toInstant(ZoneOffset.UTC), loan.getVersion(), responses.size(),
                    ownedItems.stream().map(LoanItem::getStatus).distinct().toList(), responses);
        }).toList();
        return PagedResponse.of(content, loans.getNumber(), loans.getSize(), loans.getTotalElements());
    }

    public PagedResponse<BorrowHistoryResponse> historyMine(Integer accountId, String code, Integer itemId,
                                                            String page, String size, String sort) {
        var loan = loanRepository.findOwnedByCode(accountId, code).orElseThrow(BorrowQueryService::notFound);
        if (!loanItemRepository.existsByIdAndLoanId(itemId, loan.getId())) {
            throw new BusinessException(HttpStatus.NOT_FOUND, "BORROW_ITEM_NOT_FOUND", "Không tìm thấy sách trong yêu cầu");
        }
        var pagination = BorrowPagination.parse(page, size, sort, "occurredAt", Sort.Direction.ASC);
        var events = historyRepository.findByLoanItemId(itemId, pagination);
        var content = events.getContent().stream().map(event -> new BorrowHistoryResponse(event.getId(), event.getFromStatus(),
                event.getToStatus(), event.getReasonCode(), event.getOccurredAt().toInstant(ZoneOffset.UTC), event.getNote())).toList();
        return PagedResponse.of(content, events.getNumber(), events.getSize(), events.getTotalElements());
    }

    /** Owner nằm ngay trong query; mã có thật của Member khác vẫn trả404 và không đọc dữ liệu riêng của họ. */
    public BorrowRequestResponse getMine(Integer accountId, String loanCode) {
        var loan = loanRepository.findOwnedByCode(accountId, loanCode).orElseThrow(BorrowQueryService::notFound);
        var items = loanItemRepository.findWithBookByLoanId(loan.getId());
        var positions = queuePositions(items);
        var responses = itemResponses(items, positions);
        return new BorrowRequestResponse(loan.getLoanCode(), loan.getPickupReference(), loan.getStatus(),
                loan.getCreatedAt().toInstant(ZoneOffset.UTC), loan.getVersion(), responses);
    }

    private List<BorrowItemResponse> itemResponses(List<LoanItem> items, Map<Integer, QueuePosition> positions) {
        return items.stream().map(item -> {
            var position = positions.get(item.getId());
            return BorrowItemResponse.from(item, position == null ? null : position.position(),
                    position == null ? null : position.total());
        }).toList();
    }

    private Map<Integer, QueuePosition> queuePositions(List<LoanItem> items) {
        var ids = items.stream().filter(item -> item.getStatus() == LoanItemStatus.WAITLISTED)
                .map(LoanItem::getId).toList();
        return borrowReadRepository.queuePositions(ids);
    }

    static BusinessException notFound() {
        return new BusinessException(HttpStatus.NOT_FOUND, "BORROW_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu mượn sách");
    }

}
