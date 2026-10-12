package sparkminds.librarymanagement.member.dto;

import jakarta.validation.constraints.NotNull;

public record MemberAccountStatusRequest(
        @NotNull(message = "Trạng thái hiện tại là bắt buộc") Boolean expectedEnabled,
        @NotNull(message = "Trạng thái đích là bắt buộc") Boolean enabled
) {
}
