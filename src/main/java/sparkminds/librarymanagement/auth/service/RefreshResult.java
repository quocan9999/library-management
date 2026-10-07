package sparkminds.librarymanagement.auth.service;

import sparkminds.librarymanagement.auth.dto.LoginResponse;

public record RefreshResult(LoginResponse response, String refreshToken) {
}
