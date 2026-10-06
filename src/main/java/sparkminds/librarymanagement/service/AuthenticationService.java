package sparkminds.librarymanagement.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;

import sparkminds.librarymanagement.dto.request.LoginRequest;
import sparkminds.librarymanagement.dto.response.LoginResponse;
import sparkminds.librarymanagement.exception.InvalidCredentialsException;
import sparkminds.librarymanagement.security.jwt.JwtService;
import sparkminds.librarymanagement.security.userdetails.AccountPrincipal;

@Service
public class AuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;

    public AuthenticationService(AuthenticationManager authenticationManager, JwtService jwtService) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
    }

    public LoginResponse login(LoginRequest request) {
        try {
            var authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(
                            request.identifier(), request.password()));
            AccountPrincipal principal = (AccountPrincipal) authentication.getPrincipal();
            return new LoginResponse(
                    jwtService.createAccessToken(principal),
                    "Bearer",
                    jwtService.getAccessTokenValiditySeconds());
        } catch (AuthenticationException exception) {
            throw new InvalidCredentialsException();
        }
    }
}
