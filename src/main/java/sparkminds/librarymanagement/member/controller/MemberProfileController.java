package sparkminds.librarymanagement.member.controller;

import lombok.RequiredArgsConstructor;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.dto.MemberProfilePatchRequest;
import sparkminds.librarymanagement.member.service.MemberProfileService;

@RestController
@RequestMapping("/api/v1/members")
@RequiredArgsConstructor
public class MemberProfileController {

    private final MemberProfileService memberProfileService;

    @PatchMapping("/{id}")
    @PreAuthorize("hasAuthority('member:update')")
    public ResponseEntity<ApiResponse<MemberDetailResponse>> patchProfile(
            @PathVariable Integer id,
            @Valid @RequestBody MemberProfilePatchRequest request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                200,
                "MEMBER_PROFILE_UPDATED",
                "Cập nhật hồ sơ thành viên thành công",
                memberProfileService.patchProfile(id, request)
        ));
    }
}
