package sparkminds.librarymanagement.auth.dto;

import java.util.List;

public record AuthMeResponse(
        Integer id,
        String username,
        String email,
        String role,
        List<String> permissions,
        String fullName
) {
    public AuthMeResponse(Integer id, String username, String email, String role, List<String> permissions) {
        this(id, username, email, role, permissions, null);
    }
}
