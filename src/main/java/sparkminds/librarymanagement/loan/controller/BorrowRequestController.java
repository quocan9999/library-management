package sparkminds.librarymanagement.loan.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
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
import sparkminds.librarymanagement.loan.service.BorrowRenewalService;
import sparkminds.librarymanagement.loan.dto.BorrowRenewalResponse;
import sparkminds.librarymanagement.loan.dto.RenewBorrowRequest;
import sparkminds.librarymanagement.loan.dto.ConfirmMockPaymentRequest;
import sparkminds.librarymanagement.loan.service.BorrowMockPaymentService;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/borrow-requests")
@RequiredArgsConstructor
@Tag(name = "Borrow Requests", description = "API người dùng để tạo, xem và quản lý từng LoanItem của chính mình")
@SecurityRequirement(name = "bearerAuth")
public class BorrowRequestController {

    private final BorrowReservationService reservationService;
    private final BorrowQueryService queryService;
    private final BorrowCancellationService cancellationService;
    private final BorrowRenewalService renewalService;
    private final BorrowMockPaymentService paymentService;

    @PostMapping("/mine/{loanCode}/items/{itemId}/renew")
    @Operation(summary = "Gia hạn một sách đang mượn", description = "Gia hạn miễn phí thêm 7 ngày đúng cửa sổ từ due date−3 ngày đến hết due date; tối đa một lần và không có Waitlist cho sách.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Gia hạn thành công", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Tham số hoặc request body không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Thiếu borrow:renew hoặc không phải USER", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy request/item của người dùng hiện tại", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Không đủ điều kiện gia hạn, có Waitlist hoặc version đã cũ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "expectedItemVersion không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:renew') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<BorrowRenewalResponse>> renew(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId, @Valid @RequestBody RenewBorrowRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BORROW_ITEM_RENEWED", "Đã gia hạn sách miễn phí thêm 7 ngày",
                renewalService.renew(principal.getAccountId(), loanCode, itemId, request)));
    }

    @GetMapping("/mine")
    @Operation(summary = "Liệt kê yêu cầu mượn của tôi", description = "Phân trang ổn định; status lọc theo item và vị trí Waitlist được tính từ trạng thái hiện tại.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Trang yêu cầu mượn của tôi", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Bộ lọc, phân trang hoặc sort không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Thiếu borrow:read-own hoặc không phải USER", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
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
    @Operation(summary = "Xem lịch sử một LoanItem của tôi", description = "Chỉ chủ sở hữu được xem timeline trạng thái; kết quả có phân trang và không lộ dữ liệu của thành viên khác.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Lịch sử LoanItem của tôi", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Bộ lọc, phân trang hoặc sort không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Thiếu borrow:read-own hoặc không phải USER", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy request/item của người dùng hiện tại", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
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
    @Operation(summary = "Tạo yêu cầu mượn tối đa ba đầu sách", description = "Member lấy từ JWT; một transaction tạo một Loan, giữ sách còn hàng hoặc xếp FIFO và rollback toàn bộ nếu một item không hợp lệ.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "201", description = "Yêu cầu mượn đã được tạo", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Request body không đúng định dạng", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Thiếu borrow:create, không phải USER hoặc account không đủ điều kiện", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Vượt giới hạn 3 active, trùng sách hoặc Waitlist đầy", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "Danh sách phải có 1–3 ID dương, không trùng", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:create') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<BorrowRequestResponse>> create(@AuthenticationPrincipal CustomUserPrincipal principal,
                                                                    @Valid @RequestBody CreateBorrowRequest request) {
        var result = reservationService.create(principal.getAccountId(), request);
        return ResponseEntity.created(URI.create("/api/v1/borrow-requests/mine/" + result.loanCode()))
                .header("Cache-Control", "no-store").body(ApiResponse.success(201, "BORROW_REQUEST_CREATED",
                        "Đã tạo yêu cầu đặt mượn", result));
    }

    @PostMapping("/mine/{loanCode}/mock-payment")
    @Operation(summary = "Xác nhận VietQR mô phỏng", description = "Chỉ chủ yêu cầu được xác nhận mock payment; server khóa dữ liệu, kiểm tra số tiền và hạn giữ đơn trước khi ghi nhận phí từng sách.")
    @PreAuthorize("hasAuthority('borrow:read-own') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<BorrowRequestResponse>> confirmMockPayment(
            @AuthenticationPrincipal CustomUserPrincipal principal, @PathVariable String loanCode,
            @Valid @RequestBody ConfirmMockPaymentRequest request) {
        return ResponseEntity.ok().header("Cache-Control", "no-store")
                .body(ApiResponse.success(200, "BORROW_MOCK_PAYMENT_CONFIRMED",
                        "Đã ghi nhận thanh toán mô phỏng", paymentService.confirm(principal.getAccountId(), loanCode, request)));
    }

    @GetMapping("/mine/{loanCode}")
    @Operation(summary = "Xem chi tiết yêu cầu mượn của tôi", description = "Chỉ chủ sở hữu được xem QR reference và trạng thái từng item; người khác không được suy ra request tồn tại.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Chi tiết yêu cầu mượn của tôi", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Thiếu borrow:read-own hoặc không phải USER", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy request của người dùng hiện tại", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:read-own') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<BorrowRequestResponse>> getMine(@AuthenticationPrincipal CustomUserPrincipal principal,
                                                                     @PathVariable String loanCode) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BORROW_REQUEST_DETAIL_SUCCESS", "Lấy yêu cầu mượn sách thành công",
                queryService.getMine(principal.getAccountId(), loanCode)));
    }

    @PostMapping("/mine/{loanCode}/items/{itemId}/cancel")
    @Operation(summary = "Hủy một LoanItem của tôi", description = "Hủy từng item chưa bàn giao; tồn kho và FIFO được cập nhật nguyên tử khi item đang giữ bản sách.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "LoanItem đã được hủy", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Thiếu borrow:cancel-own hoặc không phải USER", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy request/item của người dùng hiện tại", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Item đã bàn giao, đã đóng hoặc không thể hủy", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "Request body không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:cancel-own') and principal.roleCode == 'USER'")
    public ResponseEntity<ApiResponse<BorrowRequestResponse>> cancel(@AuthenticationPrincipal CustomUserPrincipal principal,
                                                                    @PathVariable String loanCode, @PathVariable Integer itemId) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200,
                "BORROW_ITEM_CANCELLED", "Đã hủy sách trong yêu cầu",
                cancellationService.cancelOwn(principal.getAccountId(), loanCode, itemId)));
    }
}
