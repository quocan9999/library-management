package sparkminds.librarymanagement.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import sparkminds.librarymanagement.loan.service.BorrowExpirationService;
import sparkminds.librarymanagement.loan.service.BorrowNotificationDispatcher;
import sparkminds.librarymanagement.loan.service.BorrowPaymentExpirationService;
import sparkminds.librarymanagement.loan.service.BorrowReminderService;

@Configuration
@ConditionalOnProperty(name = "borrow.scheduling.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class BorrowSchedulingConfiguration {
    private final BorrowExpirationService expirationService;
    private final BorrowReminderService reminderService;
    private final BorrowNotificationDispatcher dispatcher;
    private final BorrowPaymentExpirationService paymentExpirationService;

    @Bean
    public ThreadPoolTaskScheduler borrowTaskScheduler() {
        // SMTP có timeout nhưng vẫn có thể chậm; một worker gửi mail không được chặn worker giải phóng hold.
        var scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(2);
        scheduler.setThreadNamePrefix("borrow-maintenance-");
        scheduler.setWaitForTasksToCompleteOnShutdown(true);
        scheduler.setAwaitTerminationSeconds(10);
        return scheduler;
    }

    @Scheduled(scheduler = "borrowTaskScheduler", fixedDelayString = "${borrow.maintenance.delay-ms:60000}",
            initialDelayString = "${borrow.maintenance.initial-delay-ms:60000}")
    public void maintain() {
        runSafely(expirationService::expirePending, "expiration");
        runSafely(paymentExpirationService::expirePendingPayments, "payment-expiration");
        runSafely(reminderService::createDueReminders, "reminders");
    }

    @Scheduled(scheduler = "borrowTaskScheduler", fixedDelayString = "${borrow.notifications.delay-ms:30000}",
            initialDelayString = "${borrow.notifications.initial-delay-ms:15000}")
    public void dispatch() {
        runSafely(dispatcher::dispatchPending, "notifications");
    }

    private void runSafely(Runnable action, String job) {
        try {
            action.run();
        } catch (RuntimeException exception) {
            log.warn("Job mượn sách chưa hoàn tất; job={}, loại lỗi={}", job, exception.getClass().getSimpleName());
        }
    }
}
