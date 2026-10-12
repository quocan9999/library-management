package sparkminds.librarymanagement.member.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sparkminds.librarymanagement.common.api.ApiResponse;
import sparkminds.librarymanagement.member.dto.CreateMemberRequest;
import sparkminds.librarymanagement.member.dto.MemberDetailResponse;
import sparkminds.librarymanagement.member.service.MemberAdminService;

import java.net.URI;

@RestController
@RequestMapping("/api/v1/members")
public class MemberAdminController {

    private final MemberAdminService memberAdminService;

    public MemberAdminController(MemberAdminService memberAdminService) {
        this.memberAdminService = memberAdminService;
    }

    @PostMapping
    @PreAuthorize("hasAuthority('member:create')")
    public ResponseEntity<ApiResponse<MemberDetailResponse>> create(@Valid @RequestBody CreateMemberRequest request) {
        MemberDetailResponse member = memberAdminService.create(request);
        return ResponseEntity.created(URI.create("/api/v1/members/" + member.id()))
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(ApiResponse.success(
                        HttpStatus.CREATED.value(),
                        "MEMBER_CREATED",
                        "Tạo thành viên thành công.",
                        member
                ));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('member:delete')")
    public ResponseEntity<Void> delete(@PathVariable Integer id) {
        memberAdminService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
