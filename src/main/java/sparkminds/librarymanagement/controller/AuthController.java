package sparkminds.librarymanagement.controller;

import java.util.List;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import sparkminds.librarymanagement.dto.request.LoginRequest;
import sparkminds.librarymanagement.dto.response.AuthenticatedAccountResponse;
import sparkminds.librarymanagement.dto.response.LoginResponse;
import sparkminds.librarymanagement.security.userdetails.AccountPrincipal;
import sparkminds.librarymanagement.service.AuthenticationService;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final AuthenticationService authenticationService;

    public AuthController(AuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return authenticationService.login(request);
    }

    @GetMapping("/me")
    public AuthenticatedAccountResponse currentAccount(@AuthenticationPrincipal AccountPrincipal principal) {
        List<String> authorities = principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .sorted()
                .toList();
        return new AuthenticatedAccountResponse(principal.getUsername(), authorities);
    }
}
