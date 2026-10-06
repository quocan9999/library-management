package sparkminds.librarymanagement.dto.response;

public record LoginResponse(String accessToken, String tokenType, long expiresIn) {
}
