package sparkminds.librarymanagement.config;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.MapPropertySource;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import sparkminds.librarymanagement.loan.service.BorrowExpirationService;
import sparkminds.librarymanagement.loan.service.BorrowNotificationDispatcher;
import sparkminds.librarymanagement.loan.service.BorrowReminderService;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class BorrowSchedulingConfigurationTests {
    @Test
    void productionSchedulerRegistersSeparateMaintenanceAndDeliveryTasks() {
        try (var context = context(true)) {
            assertThat(context.getBean("borrowTaskScheduler", ThreadPoolTaskScheduler.class).getPoolSize()).isEqualTo(2);
            assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks()).hasSize(2);
            var jobs = context.getBean(BorrowSchedulingConfiguration.class);
            jobs.maintain();
            jobs.dispatch();
            verify(context.getBean(BorrowExpirationService.class)).expirePending();
            verify(context.getBean(BorrowReminderService.class)).createDueReminders();
            verify(context.getBean(BorrowNotificationDispatcher.class)).dispatchPending();
        }
    }

    @Test
    void testProfileSwitchDisablesOnlyBorrowBackgroundTasks() {
        try (var context = context(false)) {
            assertThat(context.getBeansOfType(BorrowSchedulingConfiguration.class)).isEmpty();
            assertThat(context.getBean(ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks()).isEmpty();
        }
    }

    private AnnotationConfigApplicationContext context(boolean enabled) {
        var context = new AnnotationConfigApplicationContext();
        context.getEnvironment().getPropertySources().addFirst(new MapPropertySource("scheduler-test", Map.of(
                "borrow.scheduling.enabled", Boolean.toString(enabled),
                "borrow.maintenance.initial-delay-ms", "3600000",
                "borrow.notifications.initial-delay-ms", "3600000")));
        context.registerBean(BorrowExpirationService.class, () -> mock(BorrowExpirationService.class));
        context.registerBean(BorrowReminderService.class, () -> mock(BorrowReminderService.class));
        context.registerBean(BorrowNotificationDispatcher.class, () -> mock(BorrowNotificationDispatcher.class));
        context.register(SchedulingEnabled.class, BorrowSchedulingConfiguration.class);
        context.refresh();
        return context;
    }

    @Configuration
    @EnableScheduling
    static class SchedulingEnabled {
    }
}
