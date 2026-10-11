package sparkminds.librarymanagement.auth.dto;

public record RegisterResponse(String email, boolean emailVerificationRequired) {
}
