package sparkminds.librarymanagement.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.Field;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class InMemoryVerificationRateLimiterTests {

    private MutableClock clock;
    private InMemoryVerificationRateLimiter limiter;

    @BeforeEach
    void createLimiterWithControllableTime() {
        clock = new MutableClock(Instant.parse("2026-10-11T12:00:00Z"));
        limiter = new InMemoryVerificationRateLimiter(clock);
    }

    @Test
    void allowsTenIpRequestsAndRejectsTheEleventhWithPositiveRetryAfter() {
        for (int request = 0; request < 10; request++) {
            assertThat(limiter.consumeResendIpRequest("198.51.100.10").allowed()).isTrue();
        }

        var result = limiter.consumeResendIpRequest("198.51.100.10");

        assertThat(result.allowed()).isFalse();
        assertThat(result.retryAfterSeconds()).isEqualTo(600);
    }

    @Test
    void countsBlockedRequestsAndUsesARequestTimeBasedRetryWindow() {
        for (int request = 0; request < 10; request++) {
            limiter.consumeResendIpRequest("198.51.100.11");
        }
        assertThat(limiter.consumeResendIpRequest("198.51.100.11").allowed()).isFalse();

        clock.advance(Duration.ofMinutes(5));
        var repeatedBlockedRequest = limiter.consumeResendIpRequest("198.51.100.11");

        assertThat(repeatedBlockedRequest.allowed()).isFalse();
        assertThat(repeatedBlockedRequest.retryAfterSeconds()).isEqualTo(300);
    }

    @Test
    void expiresIpWindowAtTheTenMinuteBoundary() {
        for (int request = 0; request < 10; request++) {
            limiter.consumeResendIpRequest("198.51.100.12");
        }
        assertThat(limiter.consumeResendIpRequest("198.51.100.12").allowed()).isFalse();

        clock.advance(Duration.ofMinutes(10));

        assertThat(limiter.consumeResendIpRequest("198.51.100.12").allowed()).isTrue();
    }

    @Test
    void serializesConcurrentIpRequestsAndAllowsOnlyTen() throws Exception {
        int callers = 24;
        CountDownLatch ready = new CountDownLatch(callers);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService executor = Executors.newFixedThreadPool(callers);
        try {
            var futures = new java.util.ArrayList<Future<InMemoryVerificationRateLimiter.IpLimitResult>>();
            for (int index = 0; index < callers; index++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("IP limiter barrier timed out");
                    }
                    return limiter.consumeResendIpRequest("198.51.100.13");
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            var results = new java.util.ArrayList<InMemoryVerificationRateLimiter.IpLimitResult>();
            for (Future<InMemoryVerificationRateLimiter.IpLimitResult> future : futures) {
                results.add(future.get(10, TimeUnit.SECONDS));
            }
            assertThat(results.stream().filter(InMemoryVerificationRateLimiter.IpLimitResult::allowed).count())
                    .isEqualTo(10);
            assertThat(results.stream().filter(result -> !result.allowed()).count()).isEqualTo(14);
            assertThat(results.stream().filter(result -> !result.allowed())
                    .allMatch(result -> result.retryAfterSeconds() > 0)).isTrue();
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void enforcesEmailCooldownAtFiftyNineButAllowsAtSixtySeconds() {
        recordSuccessfulEmailSend("reader@example.com");
        clock.advance(Duration.ofSeconds(59));

        try (var permit = limiter.lockEmailOperation("reader@example.com")) {
            assertThat(permit.canSendEmail()).isFalse();
        }

        clock.advance(Duration.ofSeconds(1));
        try (var permit = limiter.lockEmailOperation("reader@example.com")) {
            assertThat(permit.canSendEmail()).isTrue();
        }
    }

    @Test
    void capsFiveSuccessfulEmailsAndRecoversAsTheRollingHourExpires() {
        for (int send = 0; send < 5; send++) {
            recordSuccessfulEmailSend("cap@example.com");
            if (send < 4) {
                clock.advance(Duration.ofMinutes(1));
            }
        }

        try (var permit = limiter.lockEmailOperation("cap@example.com")) {
            assertThat(permit.canSendEmail()).isFalse();
        }

        // Đủ một giờ kể từ lần gửi đầu và đủ 60 giây kể từ lần gửi gần nhất.
        clock.advance(Duration.ofMinutes(60));
        try (var permit = limiter.lockEmailOperation("cap@example.com")) {
            assertThat(permit.canSendEmail()).isTrue();
            permit.recordSuccessfulSend();
        }
    }

    @Test
    void serializesConcurrentEmailReservationsAndRecordsOnlyOneSend() throws Exception {
        int callers = 12;
        CountDownLatch ready = new CountDownLatch(callers);
        CountDownLatch start = new CountDownLatch(1);
        AtomicInteger accepted = new AtomicInteger();
        ExecutorService executor = Executors.newFixedThreadPool(callers);
        try {
            var futures = new java.util.ArrayList<Future<?>>();
            for (int index = 0; index < callers; index++) {
                futures.add(executor.submit(() -> {
                    ready.countDown();
                    if (!start.await(10, TimeUnit.SECONDS)) {
                        throw new IllegalStateException("email limiter barrier timed out");
                    }
                    try (var permit = limiter.lockEmailOperation("same@example.com")) {
                        if (permit.canSendEmail()) {
                            permit.recordSuccessfulSend();
                            accepted.incrementAndGet();
                        }
                    }
                    return null;
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (Future<?> future : futures) {
                future.get(10, TimeUnit.SECONDS);
            }
            assertThat(accepted.get()).isEqualTo(1);
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void removesExpiredIpAndEmailStateDuringCleanup() throws Exception {
        limiter.consumeResendIpRequest("198.51.100.14");
        recordSuccessfulEmailSend("cleanup@example.com");

        clock.advance(Duration.ofMinutes(61));
        limiter.cleanExpiredWindows();

        assertThat(internalMap("ipWindows")).isEmpty();
        assertThat(internalMap("emailWindows")).isEmpty();
    }

    @Test
    void cleanupWaitsForAnActiveEmailPermitBeforePruningItsSendDeque() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();
        CountDownLatch cleanerStarted = new CountDownLatch(1);
        try (var permit = limiter.lockEmailOperation("cleanup-race@example.com")) {
            permit.recordSuccessfulSend();
            Future<?> cleanup = executor.submit(() -> {
                cleanerStarted.countDown();
                limiter.cleanExpiredWindows();
            });

            assertThat(cleanerStarted.await(10, TimeUnit.SECONDS)).isTrue();
            assertThatThrownBy(() -> cleanup.get(250, TimeUnit.MILLISECONDS))
                    .isInstanceOf(TimeoutException.class);
        } finally {
            executor.shutdownNow();
        }
        executor.awaitTermination(10, TimeUnit.SECONDS);
    }

    private void recordSuccessfulEmailSend(String email) {
        try (var permit = limiter.lockEmailOperation(email)) {
            assertThat(permit.canSendEmail()).isTrue();
            permit.recordSuccessfulSend();
        }
    }

    private Map<?, ?> internalMap(String fieldName) throws Exception {
        Field field = InMemoryVerificationRateLimiter.class.getDeclaredField(fieldName);
        field.setAccessible(true);
        return (Map<?, ?>) field.get(limiter);
    }
}
