package sparkminds.librarymanagement.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import sparkminds.librarymanagement.auth.web.ResendRateLimitInterceptor;

@Configuration
@RequiredArgsConstructor
public class ResendRateLimitWebConfig implements WebMvcConfigurer {

    private final ResendRateLimitInterceptor rateLimitInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/v1/auth/resend-verification", "/api/v1/auth/forgot-password");
    }
}
