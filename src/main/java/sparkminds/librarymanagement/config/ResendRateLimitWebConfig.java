package sparkminds.librarymanagement.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import sparkminds.librarymanagement.auth.web.ResendRateLimitInterceptor;

@Configuration
public class ResendRateLimitWebConfig implements WebMvcConfigurer {

    private final ResendRateLimitInterceptor rateLimitInterceptor;

    public ResendRateLimitWebConfig(ResendRateLimitInterceptor rateLimitInterceptor) {
        this.rateLimitInterceptor = rateLimitInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor)
                .addPathPatterns("/api/v1/auth/resend-verification");
    }
}
