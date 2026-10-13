package sparkminds.librarymanagement.config;

import lombok.RequiredArgsConstructor;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;
import sparkminds.librarymanagement.auth.security.ApiAuthenticationException;
import sparkminds.librarymanagement.common.api.ApiResponse;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class ApiAuthenticationEntryPoint implements AuthenticationEntryPoint {

    private final ObjectMapper objectMapper;

    @Override
    public void commence(
            HttpServletRequest request,
            HttpServletResponse response,
            AuthenticationException exception
    ) throws IOException, ServletException {
        HttpStatus status;
        String code;
        String message;
        if (exception instanceof ApiAuthenticationException apiException) {
            status = apiException.getStatus();
            code = apiException.getCode();
            message = apiException.getMessage();
        } else if (request.getHeader("Authorization") == null) {
            status = HttpStatus.UNAUTHORIZED;
            code = "AUTH_REQUIRED";
            message = "Yêu cầu đăng nhập";
        } else {
            status = HttpStatus.UNAUTHORIZED;
            code = "AUTH_TOKEN_INVALID";
            message = "Access Token không hợp lệ";
        }

        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(status.value(), code, message, null));
    }
}
