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
import sparkminds.librarymanagement.loan.dto.PrepareBorrowItemsRequest;
import sparkminds.librarymanagement.loan.dto.StaffBorrowHistoryResponse;
import sparkminds.librarymanagement.loan.dto.StaffBorrowResponse;
import sparkminds.librarymanagement.loan.dto.CreateCounterBorrowRequest;
import sparkminds.librarymanagement.loan.dto.CounterMemberOptionResponse;
import sparkminds.librarymanagement.loan.service.BorrowReservationService;
import sparkminds.librarymanagement.loan.service.StaffCounterBorrowService;
import sparkminds.librarymanagement.loan.service.BorrowHandoverService;
import sparkminds.librarymanagement.loan.service.StaffBorrowItemService;
import sparkminds.librarymanagement.loan.service.StaffBorrowQueryService;

@RestController
@RequestMapping("/api/v1/librarian")
@RequiredArgsConstructor
@Tag(name = "Librarian Borrow", description = "Quầy nhận sách cho role động khác USER có permission Borrow tương ứng")
@SecurityRequirement(name = "bearerAuth")
public class LibrarianBorrowController {
    private final StaffBorrowQueryService queryService;
    private final StaffBorrowItemService itemService;
    private final BorrowHandoverService handoverService;
    private final BorrowReservationService reservationService;
    private final StaffCounterBorrowService counterBorrowService;

    @GetMapping("/borrow-requests")
    @Operation(summary = "Liệt kê yêu cầu cần xử lý tại quầy", description = "Tìm theo q: QR, mã yêu cầu, mã hoặc họ tên thành viên; lọc trạng thái và phân trang. Sort hỗ trợ loanCode, memberName, itemCount, createdAt với asc/desc; mặc định createdAt,desc. PREPARING quá 24 giờ được đánh dấu cảnh báo, không tự hủy.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Trang yêu cầu tại quầy", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Bộ lọc, phân trang hoặc sort không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không phải role staff hoặc thiếu borrow:read", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<PagedResponse<StaffBorrowResponse>>> list(
            @RequestParam(required = false) String status, @RequestParam(required = false) String page,
            @RequestParam(required = false) String size, @RequestParam(required = false) String sort,
            @RequestParam(required = false) String q) {
        return success("BORROW_REQUEST_LIST_SUCCESS", "Lấy danh sách yêu cầu thành công", queryService.list(status, page, size, sort, q));
    }

    @GetMapping("/counter-members")
    @Operation(summary = "Tìm thành viên để tạo yêu cầu tại quầy", description = "Chỉ trả mã thành viên và họ tên của tài khoản USER đang bật, đã xác minh email.")
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<java.util.List<CounterMemberOptionResponse>>> counterMembers(
            @AuthenticationPrincipal CustomUserPrincipal principal, @RequestParam(required = false) String q) {
        return success("BORROW_COUNTER_MEMBER_SEARCH_SUCCESS", "Tìm thành viên thành công",
                counterBorrowService.searchMembers(principal.getAccountId(), q));
    }

    @PostMapping("/borrow-requests/counter")
    @Operation(summary = "Tạo yêu cầu mượn trực tiếp tại quầy", description = "Thủ thư chọn thành viên và tối đa ba đầu sách còn bản sẵn; yêu cầu được lưu bền vững để có thể đóng chi tiết và tra cứu lại.")
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> createCounter(
            @AuthenticationPrincipal CustomUserPrincipal principal,
            @Valid @RequestBody CreateCounterBorrowRequest request) {
        var created = reservationService.createForMember(principal.getAccountId(), request.memberId(),
                new sparkminds.librarymanagement.loan.dto.CreateBorrowRequest(request.bookIds()));
        return ResponseEntity.status(201).header("Cache-Control", "no-store")
                .body(ApiResponse.success(201, "BORROW_COUNTER_REQUEST_CREATED",
                        "Đã tạo yêu cầu mượn tại quầy", created));
    }

    @GetMapping("/pickups/{pickupReference}")
    @Operation(summary = "Tra cứu mã nhận sách tại quầy", description = "QR chỉ tra cứu; cần staff đăng nhập với borrow:read và xác minh danh tính riêng trước handover.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Chi tiết nhận sách tại quầy", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không phải role staff hoặc thiếu borrow:read", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy mã nhận sách", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> pickup(@PathVariable String pickupReference) {
        return success("BORROW_REQUEST_DETAIL_SUCCESS", "Lấy yêu cầu nhận sách thành công", queryService.pickup(pickupReference));
    }

    @GetMapping("/borrow-requests/{loanCode}/history")
    @Operation(summary = "Xem lịch sử yêu cầu tại quầy", description = "Trả timeline trạng thái theo item có phân trang cho staff được cấp borrow:read.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Lịch sử yêu cầu tại quầy", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Bộ lọc, phân trang hoặc sort không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không phải role staff hoặc thiếu borrow:read", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy yêu cầu", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:read') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<PagedResponse<StaffBorrowHistoryResponse>>> history(@PathVariable String loanCode,
            @RequestParam(required = false) String page, @RequestParam(required = false) String size,
            @RequestParam(required = false) String sort) {
        return success("BORROW_ITEM_HISTORY_SUCCESS", "Lấy lịch sử yêu cầu thành công", queryService.history(loanCode, page, size, sort));
    }

    @PostMapping("/borrow-requests/{loanCode}/ready")
    @Operation(summary = "Xác nhận đã chuẩn bị các sách được chọn", description = "Cập nhật đồng thời và gửi một email nhận sách cho cả lần chuẩn bị.")
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> readyBatch(
            @AuthenticationPrincipal CustomUserPrincipal principal, @PathVariable String loanCode,
            @Valid @RequestBody PrepareBorrowItemsRequest request) {
        return success("BORROW_ITEMS_READY", "Các sách đã sẵn sàng nhận",
                itemService.readyBatch(principal.getAccountId(), loanCode, request.itemIds()));
    }

    @PostMapping("/borrow-requests/{loanCode}/items/{itemId}/prepare")
    @Operation(summary = "Bắt đầu chuẩn bị sách", description = "Chuyển RESERVED sang PREPARING; actor được lấy từ JWT và cần borrow:prepare.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Sách đang được chuẩn bị", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không phải role staff hoặc thiếu borrow:prepare", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy request/item", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Item không ở trạng thái RESERVED", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> prepare(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId) {
        return success("BORROW_ITEM_PREPARING", "Đã bắt đầu chuẩn bị sách", itemService.prepare(principal.getAccountId(), loanCode, itemId));
    }

    @PostMapping("/borrow-requests/{loanCode}/items/{itemId}/ready")
    @Operation(summary = "Xác nhận sách sẵn sàng nhận", description = "Chuyển PREPARING sang READY_FOR_PICKUP và đặt deadline chính xác 72 giờ từ readyAt.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Sách đã sẵn sàng nhận", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không phải role staff hoặc thiếu borrow:prepare", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy request/item", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Item không ở trạng thái PREPARING", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> ready(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId) {
        return success("BORROW_ITEM_READY", "Sách đã sẵn sàng nhận", itemService.ready(principal.getAccountId(), loanCode, itemId));
    }

    @PostMapping("/borrow-requests/{loanCode}/items/{itemId}/cancel")
    @Operation(summary = "Hủy item chưa bàn giao tại quầy", description = "Hủy item theo yêu cầu thành viên trước khi xác nhận thu phí; giải phóng tồn và promote FIFO trong cùng transaction.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Item đã được hủy tại quầy", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không phải role staff hoặc thiếu borrow:cancel", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy request/item", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Item đã bàn giao hoặc không thể hủy", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:cancel') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> cancel(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId) {
        return success("BORROW_ITEM_CANCELLED", "Đã hủy sách theo yêu cầu thành viên", itemService.cancel(principal.getAccountId(), loanCode, itemId));
    }

    @PostMapping("/borrow-requests/{loanCode}/items/{itemId}/reject")
    @Operation(summary = "Ghi nhận không tìm thấy bản sách", description = "Chuyển item chưa giao sang REJECTED khi bản vật lý không có; không cộng tồn kho giả.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Item đã được reject", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không phải role staff hoặc thiếu borrow:prepare", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy request/item", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Item không thể reject từ trạng thái hiện tại", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:prepare') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> reject(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @PathVariable Integer itemId) {
        return success("BORROW_ITEM_REJECTED", "Đã ghi nhận không tìm thấy bản sách vật lý", itemService.reject(principal.getAccountId(), loanCode, itemId));
    }

    @PostMapping("/borrow-requests/{loanCode}/handover")
    @Operation(summary = "Xác nhận phí và bàn giao toàn bộ sách READY", description = "Yêu cầu borrow:handover và borrow:fee-confirm. identityVerified phải đúng; items phải trùng chính xác toàn bộ READY còn hạn. Phí, actor, borrowedAt, dueDate và lịch sử commit atomic; ADMIN không bypass overdue, nợ hoặc deadline.")
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Phí đã xác nhận và toàn bộ sách READY đã bàn giao", useReturnTypeSchema = true),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "400", description = "Request body không đúng định dạng", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "401", description = "Thiếu hoặc access token không hợp lệ", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không phải role staff hoặc thiếu một trong hai permission", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "404", description = "Không tìm thấy yêu cầu/item", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "409", description = "Set READY sai, hết hạn, mất điều kiện, version cũ hoặc đã bàn giao", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "422", description = "Chưa xác minh danh tính, phí sai, item trùng hoặc amount âm", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "500", description = "Lỗi nội bộ; response không chứa SQL hoặc stack trace", content = @io.swagger.v3.oas.annotations.media.Content(schema = @io.swagger.v3.oas.annotations.media.Schema(implementation = sparkminds.librarymanagement.common.api.ApiResponse.class)))
    })
    @PreAuthorize("hasAuthority('borrow:handover') and hasAuthority('borrow:fee-confirm') and principal.roleCode != 'USER'")
    public ResponseEntity<ApiResponse<StaffBorrowResponse>> handover(@AuthenticationPrincipal CustomUserPrincipal principal,
            @PathVariable String loanCode, @Valid @RequestBody HandoverRequest request) {
        return success("BORROW_HANDOVER_COMPLETED", "Đã xác nhận phí và bàn giao sách", handoverService.handover(principal.getAccountId(), loanCode, request));
    }

    private <T> ResponseEntity<ApiResponse<T>> success(String code, String message, T data) {
        return ResponseEntity.ok().header("Cache-Control", "no-store").body(ApiResponse.success(200, code, message, data));
    }
}
