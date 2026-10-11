package sparkminds.librarymanagement.auth.dto;

public record LoginResponse(String accessToken, String tokenType, long accessTokenExpiresIn) {
}
