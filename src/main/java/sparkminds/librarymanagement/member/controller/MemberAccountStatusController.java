package sparkminds.librarymanagement.member.controller;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.member.dto.MemberAccountStatusRequest;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.service.MemberAccountStatusService;

@RestController
@RequestMapping("/api/v1/members")
public class MemberAccountStatusController {

    private final MemberAccountStatusService memberAccountStatusService;

    public MemberAccountStatusController(MemberAccountStatusService memberAccountStatusService) {
        this.memberAccountStatusService = memberAccountStatusService;
    }

    @PatchMapping("/{id}/account-status")
    @PreAuthorize("hasAuthority('member:status:update')")
    public ResponseEntity<ApiResponse<MemberDetailResponse>> updateAccountStatus(
            @PathVariable Integer id,
            @Valid @RequestBody MemberAccountStatusRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "MEMBER_ACCOUNT_STATUS_UPDATED",
                "Cập nhật trạng thái tài khoản thành viên thành công",
                memberAccountStatusService.updateStatus(id, request)
        ));
    }
}
