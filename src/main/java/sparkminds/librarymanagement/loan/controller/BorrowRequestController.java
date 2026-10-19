package sparkminds.librarymanagement.loan.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.loan.dto.BorrowRequestResponse;
import sparkminds.librarymanagement.loan.dto.CreateBorrowRequest;
import sparkminds.librarymanagement.loan.dto.BorrowRequestSummaryResponse;
import sparkminds.librarymanagement.loan.dto.BorrowHistoryResponse;
import sparkminds.librarymanagement.common.api.PagedResponse;
import sparkminds.librarymanagement.loan.service.BorrowQueryService;
import sparkminds.librarymanagement.loan.service.BorrowReservationService;
import sparkminds.librarymanagement.loan.service.BorrowCancellationService;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/borrow-requests")
@RequiredArgsConstructor
public class BorrowRequestController {

    private final BorrowReservationService reservationService;
    private final BorrowQueryService queryService;
    private final BorrowCancellationService cancellationService;

    @GetMapping("/mine")
    @PreAuthorize("hasAuthority('borrow:read-own') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<PagedResponse<BorrowRequestSummaryResponse>>> listMine(
            @AuthenticationPrincipal CustomUserPrincipal principal, @RequestParam(required = false) String status,
            @RequestParam(required = false) String page, @RequestParam(required = false) String size,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BORROW_REQUEST_LIST_SUCCESS", "Lấy danh sách yêu cầu mượn sách thành công",
                queryService.listMine(principal.getAccountId(), status, page, size, sort)));
    }

    @GetMapping("/mine/{loanCode}/items/{itemId}/history")
    @PreAuthorize("hasAuthority('borrow:read-own') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<PagedResponse<BorrowHistoryResponse>>> history(
            @AuthenticationPrincipal CustomUserPrincipal principal, @PathVariable String loanCode, @PathVariable Integer itemId,
            @RequestParam(required = false) String page, @RequestParam(required = false) String size,
            @RequestParam(required = false) String sort) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BORROW_ITEM_HISTORY_SUCCESS", "Lấy lịch sử sách thành công",
                queryService.historyMine(principal.getAccountId(), loanCode, itemId, page, size, sort)));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('borrow:create') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<BorrowRequestResponse>> create(@AuthenticationPrincipal CustomUserPrincipal principal,
                                                                    @Valid @RequestBody CreateBorrowRequest request) {
        var result = reservationService.create(principal.getAccountId(), request);
        return ResponseEntity.created(URI.create("/api/v1/borrow-requests/mine/" + result.loanCode()))
                .header("Cache-Control", "no-store").body(ApiResponse.success(201, "BORROW_REQUEST_CREATED",
                        "Đã tạo yêu cầu đặt mượn", result));
    }

    @GetMapping("/mine/{loanCode}")
    @PreAuthorize("hasAuthority('borrow:read-own') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<BorrowRequestResponse>> getMine(@AuthenticationPrincipal CustomUserPrincipal principal,
                                                                     @PathVariable String loanCode) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BORROW_REQUEST_DETAIL_SUCCESS", "Lấy yêu cầu mượn sách thành công",
                queryService.getMine(principal.getAccountId(), loanCode)));
    }

    @PostMapping("/mine/{loanCode}/items/{itemId}/cancel")
    @PreAuthorize("hasAuthority('borrow:cancel-own') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<BorrowRequestResponse>> cancel(@AuthenticationPrincipal CustomUserPrincipal principal,
                                                                    @PathVariable String loanCode, @PathVariable Integer itemId) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BORROW_ITEM_CANCELLED", "Đã hủy sách trong yêu cầu",
                cancellationService.cancelOwn(principal.getAccountId(), loanCode, itemId)));
    }
}
