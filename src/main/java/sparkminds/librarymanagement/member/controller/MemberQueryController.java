package sparkminds.librarymanagement.member.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.member.dto.LoanHistoryItemResponse;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.dto.MemberListItemResponse;
import sparkminds.librarymanagement.member.dto.PagedResponse;
import sparkminds.librarymanagement.member.service.MemberQueryService;

@RestController
@RequestMapping("/api/v1/members")
public class MemberQueryController {

    private final MemberQueryService memberQueryService;

    public MemberQueryController(MemberQueryService memberQueryService) {
        this.memberQueryService = memberQueryService;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('member:read')")
    public ResponseEntity<ApiResponse<PagedResponse<MemberListItemResponse>>> list(
            @RequestParam(required = false) String fullName,
            @RequestParam(required = false) String memberCode,
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String phone,
            @RequestParam(required = false) String birthFrom,
            @RequestParam(required = false) String birthTo,
            @RequestParam(required = false) String book,
            @RequestParam(required = false) String borrowStatus,
            @RequestParam(required = false) String emailVerified,
            @RequestParam(required = false) String enabled,
            @RequestParam(required = false) String page,
            @RequestParam(required = false) String size,
            @RequestParam(required = false) String sort
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "MEMBER_LIST_SUCCESS",
                "Lấy danh sách thành viên thành công",
                memberQueryService.searchMembers(fullName, memberCode, email, phone, birthFrom, birthTo,
                        book, borrowStatus, emailVerified, enabled, page, size, sort)
        ));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('member:read')")
    public ResponseEntity<ApiResponse<MemberDetailResponse>> detail(@PathVariable Integer id) {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "MEMBER_DETAIL_SUCCESS",
                "Lấy thông tin thành viên thành công",
                memberQueryService.getMember(id)
        ));
    }

    @GetMapping("/{id}/loan-history")
    @PreAuthorize("hasAuthority('member:read')")
    public ResponseEntity<ApiResponse<PagedResponse<LoanHistoryItemResponse>>> loanHistory(
            @PathVariable Integer id,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String page,
            @RequestParam(required = false) String size
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "MEMBER_LOAN_HISTORY_SUCCESS",
                "Lấy lịch sử mượn trả thành công",
                memberQueryService.getLoanHistory(id, status, page, size)
        ));
    }
}
