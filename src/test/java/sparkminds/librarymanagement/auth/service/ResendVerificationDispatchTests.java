package sparkminds.librarymanagement.auth.service;

import org.junit.jupiter.api.Test;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.doThrow;
import static org.assertj.core.api.Assertions.assertThatCode;

/** Kiểm tra HTTP thread không chạm DB hoặc SMTP trước khi worker bắt đầu. */
class ResendVerificationDispatchTests {
    @Test
    void dispatchesWithoutCheckingAccountOrWaitingForSmtpOnCallerThread() {
        var limiter = mock(InMemoryVerificationRateLimiter.class);
        var transactionService = mock(ResendVerificationTransactionService.class);
        var mailSender = mock(RegistrationMailSender.class);
        var executor = mock(TaskExecutor.class);
        var service = new ResendVerificationService(limiter, transactionService, mailSender, executor);

        service.resend("reader@example.com");
        verify(executor).execute(any(Runnable.class));
        verifyNoInteractions(limiter, transactionService, mailSender);
    }

    @Test
    void busyQueueDoesNotLeakAccountStateOrTurnGenericResponseIntoFailure() {
        var limiter = mock(InMemoryVerificationRateLimiter.class);
        var transactionService = mock(ResendVerificationTransactionService.class);
        var mailSender = mock(RegistrationMailSender.class);
        var executor = mock(TaskExecutor.class);
        doThrow(new TaskRejectedException("full")).when(executor).execute(any(Runnable.class));
        var service = new ResendVerificationService(limiter, transactionService, mailSender, executor);

        assertThatCode(() -> service.resend("reader@example.com")).doesNotThrowAnyException();
        verifyNoInteractions(limiter, transactionService, mailSender);
    }
}
