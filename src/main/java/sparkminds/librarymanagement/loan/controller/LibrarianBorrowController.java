package sparkminds.librarymanagement.loan.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.auth.security.CustomUserPrincipal;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.common.api.PagedResponse;
import sparkminds.librarymanagement.loan.dto.HandoverRequest;
import sparkminds.librarymanagement.loan.dto.StaffBorrowHistoryResponse;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.service.BorrowHandoverService;
import sparkminds.librarymanagement.loan.service.StaffBorrowItemService;
import sparkminds.librarymanagement.loan.service.StaffBorrowQueryService;

@RestController
@RequestMapping("/api/v1/librarian")
@RequiredArgsConstructor
public class LibrarianBorrowController {
    private final StaffBorrowQueryService queryService;
    private final StaffBorrowItemService itemService;
    private final BorrowHandoverService handoverService;

    @GetMapping("/borrow-requests")
    @PreAuthorize("hasAuthority('borrow:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<PagedResponse<StaffBorrowResponse>>> list(
            @RequestParam(required = false) String status, @RequestParam(required = false) String page,
            @RequestParam(required = false) String size, @RequestParam(required = false) String sort) {
        return success("BORROW_REQUEST_LIST_SUCCESS", "Lấy danh sách yêu cầu thành công", queryService.list(status, page, size, sort));
    }

    @GetMapping("/pickups/{pickupReference}")
    @PreAuthorize("hasAuthority('borrow:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> pickup(@PathVariable String pickupReference) {
        return success("BORROW_REQUEST_DETAIL_SUCCESS", "Lấy yêu cầu nhận sách thành công", queryService.pickup(pickupReference));
    }

    @GetMapping("/borrow-requests/{loanCode}/history")
    @PreAuthorize("hasAuthority('borrow:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<PagedResponse<StaffBorrowHistoryResponse>>> history(@PathVariable String loanCode,
            @RequestParam(required = false) String page, @RequestParam(required = false) String size,
            @RequestParam(required = false) String sort) {
        return success("BORROW_ITEM_HISTORY_SUCCESS", "Lấy lịch sử yêu cầu thành công", queryService.history(loanCode, page, size, sort));
    }

    @PostMapping("/borrow-requests/{loanCode}/items/{itemId}/prepare")
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> prepare(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId) {
        return success("BORROW_ITEM_PREPARING", "Đã bắt đầu chuẩn bị sách", itemService.prepare(principal.getAccountId(), loanCode, itemId));
    }

    @PostMapping("/borrow-requests/{loanCode}/items/{itemId}/ready")
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> ready(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId) {
        return success("BORROW_ITEM_READY", "Sách đã sẵn sàng nhận", itemService.ready(principal.getAccountId(), loanCode, itemId));
    }

    @PostMapping("/borrow-requests/{loanCode}/items/{itemId}/cancel")
    @PreAuthorize("hasAuthority('borrow:cancel') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> cancel(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId) {
        return success("BORROW_ITEM_CANCELLED", "Đã hủy sách theo yêu cầu thành viên", itemService.cancel(principal.getAccountId(), loanCode, itemId));
    }

    @PostMapping("/borrow-requests/{loanCode}/items/{itemId}/reject")
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> reject(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId) {
        return success("BORROW_ITEM_REJECTED", "Đã ghi nhận không tìm thấy bản sách vật lý", itemService.reject(principal.getAccountId(), loanCode, itemId));
    }

    @PostMapping("/borrow-requests/{loanCode}/handover")
    @PreAuthorize("hasAuthority('borrow:handover') and hasAuthority('borrow:fee-confirm') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> handover(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @Valid @RequestBody HandoverRequest request) {
        return success("BORROW_HANDOVER_COMPLETED", "Đã xác nhận phí và bàn giao sách", handoverService.handover(principal.getAccountId(), loanCode, request));
    }

    private <T> ResponseEntity<ApiResponse<T>> success(String code, String message, T data) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200, code, message, data));
    }
}
