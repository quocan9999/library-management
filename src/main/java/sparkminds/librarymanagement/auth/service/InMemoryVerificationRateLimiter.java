package sparkminds.librarymanagement.auth.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/** Giới hạn resend theo IP và email trong bộ nhớ của một instance ứng dụng. */
@Service
public class InMemoryVerificationRateLimiter {

    private static final int IP_REQUEST_LIMIT = 10;
    private static final Duration IP_WINDOW = Duration.ofMinutes(10);
    private static final int EMAIL_SEND_LIMIT = 5;
    private static final Duration EMAIL_WINDOW = Duration.ofHours(1);
    private static final Duration EMAIL_COOLDOWN = Duration.ofSeconds(60);

    private final Clock clock;
    private final ConcurrentHashMap<String, IpWindow> ipWindows = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, EmailWindow> emailWindows = new ConcurrentHashMap<>();

    public InMemoryVerificationRateLimiter(Clock clock) {
        this.clock = Objects.requireNonNull(clock);
    }

    /** Ghi nhận cả request bị chặn để mọi lần thử đều tham gia rolling window. */
    public IpLimitResult consumeResendIpRequest(String remoteAddress) {
        return consumeIpRequest("resend-verification", remoteAddress);
    }

    /** Dùng cùng rolling-window implementation nhưng không chia sẻ quota IP với resend verification. */
    public IpLimitResult consumeForgotPasswordIpRequest(String remoteAddress) {
        return consumeIpRequest("forgot-password", remoteAddress);
    }

    private IpLimitResult consumeIpRequest(String operation, String remoteAddress) {
        String key = operation + ":" + (remoteAddress == null ? "unknown" : remoteAddress);
        Instant now = clock.instant();
        IpLimitResult[] result = new IpLimitResult[1];

        ipWindows.compute(key, (ignored, current) -> {
            IpWindow window = current == null ? new IpWindow() : current;
            Instant cutoff = now.minus(IP_WINDOW);
            while (!window.requests.isEmpty() && !window.requests.peekFirst().isAfter(cutoff)) {
                window.requests.removeFirst();
            }

            boolean allowed = window.requests.size() < IP_REQUEST_LIMIT;
            window.requests.addLast(now);
            // Mười thời điểm gần nhất đủ để tính quota và Retry-After, kể cả khi bị spam liên tục.
            while (window.requests.size() > IP_REQUEST_LIMIT) {
                window.requests.removeFirst();
            }

            long retryAfter = allowed ? 0 : positiveSecondsUntil(window.requests.peekFirst().plus(IP_WINDOW), now);
            result[0] = new IpLimitResult(allowed, retryAfter);
            return window;
        });
        return result[0];
    }

    /** Giữ khóa theo email trong lúc tạo token, gửi thư và xử lý lỗi gửi. */
    public EmailOperationPermit lockEmailOperation(String email) {
        String key = normalizeEmail(email);
        EmailWindow window = emailWindows.compute(key, (ignored, current) -> {
            EmailWindow selected = current == null ? new EmailWindow() : current;
            selected.activePermits.incrementAndGet();
            return selected;
        });
        window.operationLock.lock();
        pruneSuccessfulSends(window, clock.instant());
        return new EmailOperationPermit(key, window);
    }

    /** Dọn cửa sổ hết hạn định kỳ để lượng địa chỉ client không làm map tăng mãi. */
    @Scheduled(fixedDelay = 60_000)
    public void cleanExpiredWindows() {
        Instant now = clock.instant();
        ipWindows.forEach((key, ignored) -> ipWindows.computeIfPresent(key, (unused, window) -> {
            pruneIpRequests(window, now);
            return window.requests.isEmpty() ? null : window;
        }));

        emailWindows.forEach((key, ignored) -> emailWindows.computeIfPresent(key, (unused, window) -> {
            // Đồng bộ dọn deque với kiểm tra/ghi nhận gửi để tránh race giữa scheduler và request.
            window.operationLock.lock();
            try {
                pruneSuccessfulSends(window, now);
                if (window.activePermits.get() == 0 && !window.operationLock.hasQueuedThreads()
                        && window.successfulSends.isEmpty()) {
                    return null;
                }
                return window;
            } finally {
                window.operationLock.unlock();
            }
        }));
    }

    private void pruneIpRequests(IpWindow window, Instant now) {
        Instant cutoff = now.minus(IP_WINDOW);
        while (!window.requests.isEmpty() && !window.requests.peekFirst().isAfter(cutoff)) {
            window.requests.removeFirst();
        }
    }

    private void pruneSuccessfulSends(EmailWindow window, Instant now) {
        Instant cutoff = now.minus(EMAIL_WINDOW);
        while (!window.successfulSends.isEmpty() && !window.successfulSends.peekFirst().isAfter(cutoff)) {
            window.successfulSends.removeFirst();
        }
    }

    private static String normalizeEmail(String email) {
        return Objects.requireNonNull(email).trim().toLowerCase(Locale.ROOT);
    }

    private static long positiveSecondsUntil(Instant expiry, Instant now) {
        Duration remaining = Duration.between(now, expiry);
        long seconds = remaining.getSeconds();
        if (remaining.getNano() > 0) {
            seconds++;
        }
        return Math.max(1, seconds);
    }

    public record IpLimitResult(boolean allowed, long retryAfterSeconds) {
    }

    private static final class IpWindow {
        private final ArrayDeque<Instant> requests = new ArrayDeque<>();
    }

    private static final class EmailWindow {
        private final ReentrantLock operationLock = new ReentrantLock();
        private final AtomicInteger activePermits = new AtomicInteger();
        private final ArrayDeque<Instant> successfulSends = new ArrayDeque<>();
    }

    public final class EmailOperationPermit implements AutoCloseable {
        private final String key;
        private final EmailWindow window;
        private boolean closed;

        private EmailOperationPermit(String key, EmailWindow window) {
            this.key = key;
            this.window = window;
        }

        public boolean canSendEmail() {
            ensureOpen();
            Instant now = clock.instant();
            pruneSuccessfulSends(window, now);
            if (window.successfulSends.size() >= EMAIL_SEND_LIMIT) {
                return false;
            }
            Instant lastSend = window.successfulSends.peekLast();
            return lastSend == null || !now.isBefore(lastSend.plus(EMAIL_COOLDOWN));
        }

        /** Chỉ gọi sau khi SMTP xác nhận gửi thành công. */
        public void recordSuccessfulSend() {
            ensureOpen();
            Instant now = clock.instant();
            pruneSuccessfulSends(window, now);
            window.successfulSends.addLast(now);
        }

        private void ensureOpen() {
            if (closed || !window.operationLock.isHeldByCurrentThread()) {
                throw new IllegalStateException("Email operation permit is not held by this thread");
            }
        }

        @Override
        public void close() {
            if (closed) {
                return;
            }
            ensureOpen();
            closed = true;
            window.operationLock.unlock();
            window.activePermits.decrementAndGet();
        }
    }
}
