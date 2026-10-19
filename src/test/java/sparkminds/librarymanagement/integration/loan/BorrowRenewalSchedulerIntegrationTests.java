package sparkminds.librarymanagement.integration.loan;

import com.jayway.jsonpath.JsonPath;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.jpa.EntityManagerHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;
import sparkminds.librarymanagement.book.entity.Book;
import sparkminds.librarymanagement.common.api.BusinessException;
import sparkminds.librarymanagement.loan.service.BorrowRetryExecutor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Clock cố định kiểm chứng ngày nghiệp vụ; fixture commit để retry dùng transaction mới. */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
class BorrowRenewalSchedulerIntegrationTests {
    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JwtTokenService jwt;
    @org.springframework.test.context.bean.override.mockito.MockitoBean private java.time.Clock clock;
    @org.springframework.test.context.bean.override.mockito.MockitoBean private org.springframework.mail.javamail.JavaMailSender mailSender;
    @Autowired private sparkminds.librarymanagement.loan.service.BorrowExpirationService expirationService;
    @Autowired private sparkminds.librarymanagement.loan.service.BorrowReminderService reminderService;
    @Autowired private sparkminds.librarymanagement.loan.service.BorrowNotificationDispatcher dispatcher;
    @Autowired private sparkminds.librarymanagement.loan.service.BorrowNotificationDeliveryService deliveryService;
    @Autowired private sparkminds.librarymanagement.loan.repository.BorrowNotificationRepository notificationRepository;

    private final List<Integer> accountIds = new ArrayList<>();
    private final List<Integer> bookIds = new ArrayList<>();

    @org.junit.jupiter.api.BeforeEach
    void fixedClock() {
        org.mockito.Mockito.when(clock.instant()).thenReturn(Instant.parse("2026-10-19T09:00:00Z"));
        org.mockito.Mockito.when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    }

    @AfterEach
    void removeOnlyOwnedFixtures() {
        for (Integer accountId : accountIds) {
            jdbc.update("""
                    DELETE h FROM loan_item_status_history h JOIN loan_items li ON li.id = h.loan_item_id
                    JOIN loans l ON l.id = li.loan_id JOIN members m ON m.id = l.member_id
                    WHERE m.account_id = ?
                    """, accountId);
            jdbc.update("""
                    DELETE li FROM loan_items li JOIN loans l ON l.id = li.loan_id
                    JOIN members m ON m.id = l.member_id WHERE m.account_id = ?
                    """, accountId);
            jdbc.update("DELETE l FROM loans l JOIN members m ON m.id = l.member_id WHERE m.account_id = ?", accountId);
            jdbc.update("DELETE FROM members WHERE account_id = ?", accountId);
            jdbc.update("DELETE FROM accounts WHERE id = ?", accountId);
        }
        for (Integer bookId : bookIds) {
            jdbc.update("DELETE FROM books WHERE id = ?", bookId);
        }
    }

    @Test
    void renewAtWindowStartIsFreeAddsSevenDaysOnceAndPreservesBorrowingSnapshot() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        borrowed(id, "2026-10-22");
        renew(user, code, id, 200);
        assertThat(jdbc.queryForObject("SELECT due_date FROM loan_items WHERE id = ?", java.time.LocalDate.class, id))
                .isEqualTo(java.time.LocalDate.of(2026, 10, 29));
        assertThat(jdbc.queryForObject("SELECT renewal_count FROM loan_items WHERE id = ?", Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT borrow_fee FROM loan_items WHERE id = ?", BigDecimal.class, id)).isEqualByComparingTo("25");
        assertThat(jdbc.queryForObject("SELECT borrowed_at FROM loan_items WHERE id = ?", LocalDateTime.class, id))
                .isEqualTo(LocalDateTime.of(2026, 10, 8, 9, 0));
        assertThat(jdbc.queryForObject("SELECT paid_borrow_fee FROM loan_items WHERE id = ?", BigDecimal.class, id)).isNull();
        renew(user, code, id, 409);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id = ? AND reason_code = 'RENEWAL_COMPLETED' AND notification_kind IS NULL",
                Integer.class, id)).isEqualTo(1);
        assertThat(available(book)).isZero();
    }

    @Test
    void renewRejectsTooEarlyOverdueQueueAndForeignOwnerButIncludesDueDay() throws Exception {
        UserFixture user = createUser();
        UserFixture other = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        borrowed(id, "2026-10-23");
        renew(user, code, id, 409);
        borrowed(id, "2026-10-18");
        renew(user, code, id, 409);
        borrowed(id, "2026-10-19");
        String queueCode = loanCode(createRequest(other, List.of(book), 201));
        renew(user, code, id, 409);
        renew(other, code, id, 404);
        cancel(other, queueCode, itemId(other, book), 200);
        renew(user, code, id, 200);
        assertThat(jdbc.queryForObject("SELECT due_date FROM loan_items WHERE id = ?", java.time.LocalDate.class, id))
                .isEqualTo(java.time.LocalDate.of(2026, 10, 26));
    }

    @Test
    void expirationAfterDowntimePromotesFifoOnceEvenWhenOwnerAccountWasDisabled() throws Exception {
        UserFixture holder = createUser();
        UserFixture waiter = createUser();
        int book = createBook(1, 1);
        createRequest(holder, List.of(book), 201);
        createRequest(waiter, List.of(book), 201);
        int id = itemId(holder, book);
        jdbc.update("UPDATE loan_items SET status = 'READY_FOR_PICKUP', ready_at = '2026-10-16 08:00:00', pickup_expires_at = '2026-10-19 08:00:00' WHERE id = ?", id);
        jdbc.update("UPDATE accounts SET enabled = false WHERE id = ?", holder.accountId());
        assertThat(expirationService.expirePending()).isGreaterThanOrEqualTo(1);
        assertThat(itemStatus(holder, book)).isEqualTo("EXPIRED");
        assertThat(itemStatus(waiter, book)).isEqualTo("RESERVED");
        assertThat(available(book)).isZero();
        assertThat(expirationService.expirePending()).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id = ? AND reason_code = 'PICKUP_EXPIRED' AND notification_state = 'PENDING'",
                Integer.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id = ? AND reason_code = 'QUEUE_PROMOTED' AND notification_kind IS NOT NULL",
                Integer.class, itemId(waiter, book))).isZero();
    }

    @Test
    void remindersHaveExactlyThreeDateKindsAndRepeatedScanDoesNotDuplicateIntents() throws Exception {
        UserFixture user = createUser();
        List<Integer> books = List.of(createBook(1, 1), createBook(1, 1), createBook(1, 1));
        createRequest(user, books, 201);
        borrowed(itemId(user, books.get(0)), "2026-10-22");
        borrowed(itemId(user, books.get(1)), "2026-10-19");
        borrowed(itemId(user, books.get(2)), "2026-10-18");
        assertThat(reminderService.createDueReminders()).isGreaterThanOrEqualTo(3);
        assertThat(reminderService.createDueReminders()).isZero();
        var kinds = jdbc.queryForList("""
                SELECT h.notification_kind FROM loan_item_status_history h JOIN loan_items li ON li.id = h.loan_item_id
                JOIN loans l ON l.id = li.loan_id WHERE l.member_id = ? AND h.reason_code IN
                ('DUE_REMINDER_THREE_DAYS', 'DUE_REMINDER_TODAY', 'OVERDUE_REMINDER_FIRST_DAY')
                """, String.class, user.memberId());
        assertThat(kinds).containsExactlyInAnyOrder("DUE_REMINDER_THREE_DAYS", "DUE_REMINDER_TODAY", "OVERDUE_REMINDER_FIRST_DAY");
    }

    @Test
    void renewSupersedesOldPendingReminderAndNewDueDateProducesNewIntent() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        borrowed(id, "2026-10-22");
        reminderService.createDueReminders();
        renew(user, code, id, 200);
        assertThat(jdbc.queryForObject("SELECT notification_last_error_code FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'DUE_REMINDER_THREE_DAYS'",
                String.class, id)).isEqualTo("REMINDER_SUPERSEDED");
        dispatcher.dispatchPending();
        org.mockito.Mockito.verify(mailSender, org.mockito.Mockito.times(1)).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));
        assertThat(jdbc.queryForObject("SELECT notification_sent_at FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'DUE_REMINDER_THREE_DAYS'",
                LocalDateTime.class, id)).isNull();
        setNow("2026-10-26T09:00:00Z");
        reminderService.createDueReminders();
        dispatcher.dispatchPending();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'DUE_REMINDER_THREE_DAYS' AND notification_state = 'SENT' AND notification_key LIKE '%2026-10-29%'",
                Integer.class, id)).isEqualTo(1);
    }

    @Test
    void utcDayBoundaryCreatesReminderOnlyOnCorrectDate() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        createRequest(user, List.of(book), 201);
        borrowed(itemId(user, book), "2026-10-22");
        setNow("2026-10-18T23:59:59Z");
        assertThat(reminderService.createDueReminders()).isZero();
        setNow("2026-10-19T00:00:00Z");
        assertThat(reminderService.createDueReminders()).isGreaterThanOrEqualTo(1);
        assertThat(reminderService.createDueReminders()).isZero();
    }

    @Test
    void smtpFailureKeepsCommittedReadyAndRetryMetadataSurvivesDispatcherRestart() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        createRequest(user, List.of(book), 201);
        int id = itemId(user, book);
        jdbc.update("UPDATE loan_items SET status = 'READY_FOR_PICKUP', ready_at = '2026-10-19 09:00:00', pickup_expires_at = '2026-10-22 09:00:00' WHERE id = ?", id);
        org.mockito.Mockito.doThrow(new org.springframework.mail.MailSendException("Sensitive SMTP diagnostic must stay private"))
                .when(mailSender).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));
        assertThat(dispatcher.dispatchPending()).isZero();
        assertThat(itemStatus(user, book)).isEqualTo("READY_FOR_PICKUP");
        assertThat(jdbc.queryForObject("SELECT notification_state FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", String.class, id)).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("SELECT notification_last_error_code FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", String.class, id)).isEqualTo("SMTP_DELIVERY_FAILED");
        assertThat(jdbc.queryForObject("SELECT pickup_expires_at FROM loan_items WHERE id = ?", LocalDateTime.class, id)).isEqualTo(LocalDateTime.of(2026, 10, 22, 9, 0));
        assertThat(dispatcher.dispatchPending()).isZero();
        org.mockito.Mockito.doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            return null;
        }).when(mailSender).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));
        setNow("2026-10-19T09:01:01Z");
        var restarted = new sparkminds.librarymanagement.loan.service.BorrowNotificationDispatcher(notificationRepository,
                deliveryService, clock);
        assertThat(restarted.dispatchPending()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT notification_attempts FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", Integer.class, id)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT notification_state FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", String.class, id)).isEqualTo("SENT");
    }

    @Test
    void abandonedLeaseCanBeReclaimedAndOldWorkerCannotOverwriteNewDelivery() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        createRequest(user, List.of(book), 201);
        long event = jdbc.queryForObject("SELECT id FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", Long.class, itemId(user, book));
        var abandoned = notificationRepository.claim(event, LocalDateTime.of(2026, 10, 19, 9, 0)).orElseThrow();
        assertThat(dispatcher.dispatchPending()).isZero();
        setNow("2026-10-19T09:05:00Z");
        assertThat(dispatcher.dispatchPending()).isEqualTo(1);
        notificationRepository.failed(abandoned, null, "SMTP_DELIVERY_FAILED");
        assertThat(jdbc.queryForObject("SELECT notification_state FROM loan_item_status_history WHERE id = ?", String.class, event)).isEqualTo("SENT");
        assertThat(jdbc.queryForObject("SELECT notification_attempts FROM loan_item_status_history WHERE id = ?", Integer.class, event)).isEqualTo(2);
    }

    @Test
    void smtpRetryIsBoundedAndExhaustedFailureRemainsVisibleWithoutFurtherSends() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        createRequest(user, List.of(book), 201);
        org.mockito.Mockito.doThrow(new org.springframework.mail.MailSendException("SMTP unavailable"))
                .when(mailSender).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));
        for (int attempt = 0; attempt < 6; attempt++) {
            org.mockito.Mockito.when(clock.instant()).thenReturn(Instant.parse("2026-10-19T09:00:00Z").plusSeconds(attempt * 3600L));
            assertThat(dispatcher.dispatchPending()).isZero();
        }
        org.mockito.Mockito.verify(mailSender, org.mockito.Mockito.times(5)).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));
        assertThat(jdbc.queryForObject("SELECT notification_next_attempt_at FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", LocalDateTime.class, itemId(user, book))).isNull();
        assertThat(jdbc.queryForObject("SELECT notification_state FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", String.class, itemId(user, book))).isEqualTo("FAILED");
    }

    @Test
    void renewalRouteEnforcesAuthenticationRoleValidationAndExpectedVersion() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        renew(user, code, id, 409);
        borrowed(id, "2026-10-22");
        mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/renew", code, id)
                        .contentType(APPLICATION_JSON).content("{\"expectedItemVersion\":0}"))
                .andExpect(status().isUnauthorized());
        Integer adminId = jdbc.queryForObject("SELECT id FROM accounts WHERE is_system_account = true", Integer.class);
        Long adminVersion = jdbc.queryForObject("SELECT session_version FROM accounts WHERE id = ?", Long.class, adminId);
        mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/renew", code, id)
                        .header("Authorization", "Bearer " + jwt.issue(adminId, adminVersion, JwtTokenType.ACCESS).value())
                        .contentType(APPLICATION_JSON).content("{\"expectedItemVersion\":0}"))
                .andExpect(status().isForbidden());
        for (String body : List.of("{}", "{\"expectedItemVersion\":-1}")) {
            mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/renew", code, id)
                            .header("Authorization", bearer(user)).contentType(APPLICATION_JSON).content(body))
                    .andExpect(status().isUnprocessableEntity());
        }
        jdbc.update("UPDATE loan_items SET version = version + 1 WHERE id = ?", id);
        mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/renew", code, id)
                        .header("Authorization", bearer(user)).contentType(APPLICATION_JSON).content("{\"expectedItemVersion\":0}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BORROW_VERSION_CONFLICT"));
        assertThat(jdbc.queryForObject("SELECT renewal_count FROM loan_items WHERE id = ?", Integer.class, id)).isZero();
    }

    @Test
    void concurrentRenewalAndEnqueueHaveValidBookLockOrderAndNoQueueBypass() throws Exception {
        UserFixture holder = createUser();
        UserFixture newcomer = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(holder, List.of(book), 201));
        int id = itemId(holder, book);
        borrowed(id, "2026-10-22");
        long version = jdbc.queryForObject("SELECT version FROM loan_items WHERE id = ?", Long.class, id);
        var responses = race(() -> mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/renew", code, id)
                        .header("Authorization", bearer(holder)).contentType(APPLICATION_JSON)
                        .content("{\"expectedItemVersion\":" + version + "}"))
                .andReturn().getResponse().getStatus(),
                () -> createRequest(newcomer, List.of(book), 201).getResponse().getStatus());
        assertThat(responses.get(0)).isIn(200, 409);
        assertThat(responses.get(1)).isEqualTo(201);
        assertThat(itemStatus(newcomer, book)).isEqualTo("WAITLISTED");
        assertThat(jdbc.queryForObject("SELECT renewal_count FROM loan_items WHERE id = ?", Integer.class, id))
                .isEqualTo(responses.get(0) == 200 ? 1 : 0);
        assertThat(available(book)).isZero();
    }

    @Test
    void concurrentDispatchersClaimOneIntentAndSendOnlyAfterClaimTransactionCommits() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        createRequest(user, List.of(book), 201);
        org.mockito.Mockito.doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            assertThat(jdbc.queryForObject("SELECT notification_state FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", String.class, itemId(user, book)))
                    .isEqualTo("PENDING");
            return null;
        }).when(mailSender).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));
        var results = race(dispatcher::dispatchPending, dispatcher::dispatchPending);
        assertThat(results).containsExactlyInAnyOrder(1, 0);
        org.mockito.Mockito.verify(mailSender, org.mockito.Mockito.times(1)).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));
        assertThat(jdbc.queryForObject("SELECT notification_attempts FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", Integer.class, itemId(user, book))).isEqualTo(1);
    }

    @Test
    void concurrentReminderScansDoNotDuplicateTheDeterministicIntent() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        createRequest(user, List.of(book), 201);
        int id = itemId(user, book);
        borrowed(id, "2026-10-22");
        var results = race(reminderService::createDueReminders, reminderService::createDueReminders);
        assertThat(results).containsExactlyInAnyOrder(1, 0);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'DUE_REMINDER_THREE_DAYS'", Integer.class, id)).isEqualTo(1);
    }

    @Test
    void renewalWaitsForAnInFlightReminderSoOldDueCannotBeSentAfterRenewalCommits() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        jdbc.update("UPDATE loan_item_status_history SET notification_state = 'SENT', notification_sent_at = UTC_TIMESTAMP(6), notification_next_attempt_at = NULL WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", id);
        borrowed(id, "2026-10-22");
        assertThat(reminderService.createDueReminders()).isEqualTo(1);

        var smtpEntered = new CountDownLatch(1);
        var releaseSmtp = new CountDownLatch(1);
        var renewalFinished = new CountDownLatch(1);
        var renewalFinishedBeforeSmtp = new java.util.concurrent.atomic.AtomicBoolean();
        var executor = Executors.newFixedThreadPool(2);
        org.mockito.Mockito.doAnswer(invocation -> {
            assertThat(TransactionSynchronizationManager.isActualTransactionActive()).isTrue();
            smtpEntered.countDown();
            if (!releaseSmtp.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("SMTP barrier timeout");
            renewalFinishedBeforeSmtp.set(renewalFinished.getCount() == 0);
            return null;
        }).when(mailSender).send(org.mockito.ArgumentMatchers.any(org.springframework.mail.SimpleMailMessage.class));

        try {
            var dispatch = executor.submit(dispatcher::dispatchPending);
            assertThat(smtpEntered.await(10, TimeUnit.SECONDS)).isTrue();
            long version = jdbc.queryForObject("SELECT version FROM loan_items WHERE id = ?", Long.class, id);
            var renew = executor.submit(() -> {
                try {
                    return mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/renew", code, id)
                                    .header("Authorization", bearer(user)).contentType(APPLICATION_JSON)
                                    .content("{\"expectedItemVersion\":" + version + "}"))
                            .andReturn().getResponse().getStatus();
                } finally {
                    renewalFinished.countDown();
                }
            });

            assertThat(renewalFinished.await(500, TimeUnit.MILLISECONDS)).isFalse();
            releaseSmtp.countDown();
            assertThat(dispatch.get(20, TimeUnit.SECONDS)).isEqualTo(1);
            assertThat(renew.get(20, TimeUnit.SECONDS)).isEqualTo(200);
            assertThat(renewalFinishedBeforeSmtp.get()).isFalse();
            assertThat(jdbc.queryForObject("SELECT due_date FROM loan_items WHERE id = ?", java.time.LocalDate.class, id))
                    .isEqualTo(java.time.LocalDate.of(2026, 10, 29));
            assertThat(jdbc.queryForObject("SELECT notification_state FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'DUE_REMINDER_THREE_DAYS'", String.class, id)).isEqualTo("SENT");
        } finally {
            releaseSmtp.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    @Test
    void concurrentExpireAndOwnCancelNeverReleaseAnExpiredHoldTwice() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        jdbc.update("UPDATE loan_items SET status = 'READY_FOR_PICKUP', ready_at = '2026-10-16 09:00:00', pickup_expires_at = '2026-10-19 09:00:00' WHERE id = ?", id);
        var results = race(expirationService::expirePending, () -> mvc.perform(
                post("/api/v1/borrow-requests/mine/{code}/items/{id}/cancel", code, id)
                        .header("Authorization", bearer(user))).andReturn().getResponse().getStatus());
        assertThat(results).containsExactly(1, 409);
        assertThat(itemStatus(user, book)).isEqualTo("EXPIRED");
        assertThat(available(book)).isEqualTo(1);
        assertThat(expirationService.expirePending()).isZero();
    }

    @Test
    void lastAbandonedAttemptEventuallyBecomesVisibleFailureInsteadOfPendingForever() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        createRequest(user, List.of(book), 201);
        long event = jdbc.queryForObject("SELECT id FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'REQUEST_CREATED'", Long.class, itemId(user, book));
        for (int attempt = 0; attempt < 5; attempt++) {
            assertThat(notificationRepository.claim(event, LocalDateTime.of(2026, 10, 19, 9, 0).plusMinutes(attempt * 5L))).isPresent();
        }
        setNow("2026-10-19T09:25:00Z");
        assertThat(dispatcher.dispatchPending()).isZero();
        assertThat(jdbc.queryForObject("SELECT notification_state FROM loan_item_status_history WHERE id = ?", String.class, event)).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("SELECT notification_last_error_code FROM loan_item_status_history WHERE id = ?", String.class, event)).isEqualTo("DELIVERY_ATTEMPTS_EXHAUSTED");
        org.mockito.Mockito.verifyNoInteractions(mailSender);
    }

    /** Cả hai tác vụ qua cùng cổng xuất phát; luôn đợi executor kết thúc trước khi cleanup fixture. */
    private <T> List<T> race(Callable<T> first,
                            Callable<T> second) throws Exception {
        var start = new CountDownLatch(1);
        var ready = new CountDownLatch(2);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var futures = List.of(first, second).stream().map(action -> executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Race start timeout");
                return action.call();
            })).toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<T> results = new ArrayList<>();
            for (var future : futures) results.add(future.get(30, TimeUnit.SECONDS));
            return results;
        } finally {
            start.countDown();
            executor.shutdown();
            if (!executor.awaitTermination(40, TimeUnit.SECONDS)) {
                executor.shutdownNow();
                assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
            }
        }
    }

    private void setNow(String instant) {
        org.mockito.Mockito.when(clock.instant()).thenReturn(Instant.parse(instant));
    }

    private void borrowed(int id, String due) {
        jdbc.update("UPDATE loan_items SET status = 'BORROWED', borrowed_at = '2026-10-08 09:00:00', due_date = ? WHERE id = ?", due, id);
    }

    private void renew(UserFixture user, String code, int id, int expected) throws Exception {
        long version = jdbc.queryForObject("SELECT version FROM loan_items WHERE id = ?", Long.class, id);
        mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/renew", code, id)
                        .header("Authorization", bearer(user)).contentType(APPLICATION_JSON)
                        .content("{\"expectedItemVersion\":" + version + "}"))
                .andExpect(status().is(expected));
    }

    private Integer itemId(UserFixture user, int bookId) {
        return jdbc.queryForObject("SELECT li.id FROM loan_items li JOIN loans l ON l.id = li.loan_id WHERE l.member_id = ? AND li.book_id = ?",
                Integer.class, user.memberId(), bookId);
    }

    private void cancel(UserFixture user, String code, int itemId, int expectedStatus) throws Exception {
        mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/cancel", code, itemId)
                        .header("Authorization", bearer(user)).contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().is(expectedStatus));
    }

    private MvcResult createRequest(UserFixture user, List<Integer> books, int expectedStatus) throws Exception {
        return mvc.perform(post("/api/v1/borrow-requests").header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON).content(body(books)))
                .andExpect(status().is(expectedStatus)).andReturn();
    }

    private static String body(List<Integer> books) {
        return "{\"bookIds\":" + books + "}";
    }

    private static String loanCode(MvcResult result) throws Exception {
        return JsonPath.read(result.getResponse().getContentAsString(), "$.data.loanCode");
    }

    private String itemStatus(UserFixture user, int bookId) {
        return jdbc.queryForObject("""
                SELECT li.status FROM loan_items li JOIN loans l ON l.id = li.loan_id
                WHERE l.member_id = ? AND li.book_id = ?
                """, String.class, user.memberId(), bookId);
    }

    private int available(int bookId) {
        return jdbc.queryForObject("SELECT available_quantity FROM books WHERE id = ?", Integer.class, bookId);
    }

    private static String bearer(UserFixture user) {
        return "Bearer " + user.token();
    }

    private UserFixture createUser() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled)
                SELECT ?, ?, 'fixture-hash', id, true, true FROM roles WHERE code = 'USER'
                """, "br" + suffix, "br" + suffix + "@example.test");
        int accountId = jdbc.queryForObject("SELECT id FROM accounts WHERE username = ?", Integer.class, "br" + suffix);
        accountIds.add(accountId);
        jdbc.update("""
                INSERT INTO members (account_id, member_code, full_name, date_of_birth)
                VALUES (?, ?, 'Borrow fixture', '1990-01-01')
                """, accountId, "BR-" + suffix);
        int memberId = jdbc.queryForObject("SELECT id FROM members WHERE account_id = ?", Integer.class, accountId);
        return new UserFixture(accountId, memberId, jwt.issue(accountId, 0, JwtTokenType.ACCESS).value());
    }

    private int createBook(int total, int available) {
        String code = "BR-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO books (book_code, title, author, total_quantity, available_quantity, borrow_fee, late_fee_per_day)
                VALUES (?, ?, 'Borrow fixture', ?, ?, 25.00, 1.50)
                """, code, code, total, available);
        int id = jdbc.queryForObject("SELECT id FROM books WHERE book_code = ?", Integer.class, code);
        bookIds.add(id);
        return id;
    }

    private record UserFixture(int accountId, int memberId, String token) {
    }
}
