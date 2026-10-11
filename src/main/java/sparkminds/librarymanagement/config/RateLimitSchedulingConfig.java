package sparkminds.librarymanagement.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import java.util.concurrent.ThreadPoolExecutor;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class RateLimitSchedulingConfig {

    /**
     * Hàng đợi có giới hạn, không để request resend bị giữ trong lúc SMTP chờ mạng.
     * AbortPolicy từ chối khi đầy; API vẫn trả response chung, worker không được chạy trong HTTP thread.
     */
    @Bean(name = "verificationMailExecutor")
    public TaskExecutor verificationMailExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("verification-mail-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(10);
        executor.initialize();
        return executor;
    }
}
