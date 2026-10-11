package sparkminds.librarymanagement.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import sparkminds.librarymanagement.auth.security.jwt.JwtProperties;

import java.time.Clock;
import java.security.SecureRandom;

@Configuration
@EnableConfigurationProperties(JwtProperties.class)
public class JwtConfiguration {

    @Bean
    public Clock jwtClock() {
        return Clock.systemUTC();
    }

    @Bean
    public SecureRandom securitySecureRandom() {
        return new SecureRandom();
    }
}
