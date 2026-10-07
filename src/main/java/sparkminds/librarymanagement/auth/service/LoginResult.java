package sparkminds.librarymanagement.auth.service;

import sparkminds.librarymanagement.auth.dto.LoginResponse;

public record LoginResult(LoginResponse response, String refreshToken) {
}
