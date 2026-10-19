package sparkminds.librarymanagement.integration.loan;

import com.jayway.jsonpath.JsonPath;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;

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

/** Staff fixture có Role động thực trong DB; mỗi mutation chạy transaction riêng như request thật. */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
class BorrowHandoverIntegrationTests {
    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JwtTokenService jwt;
    @org.springframework.test.context.bean.override.mockito.MockitoBean
    private java.time.Clock clock;
    @org.springframework.test.context.bean.override.mockito.MockitoSpyBean
    private sparkminds.librarymanagement.loan.service.BorrowAuditService auditService;

    @org.junit.jupiter.api.BeforeEach
    void useFixedUtcClock() {
        org.mockito.Mockito.when(clock.instant()).thenReturn(Instant.parse("2026-10-19T09:00:00Z"));
        org.mockito.Mockito.when(clock.getZone()).thenReturn(ZoneOffset.UTC);
    }

    private final List<Integer> accountIds = new ArrayList<>();
    private final List<Integer> bookIds = new ArrayList<>();
    private final List<Integer> staffIds = new ArrayList<>();
    private final List<Integer> roleIds = new ArrayList<>();

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
        for (Integer id : staffIds) jdbc.update("DELETE FROM accounts WHERE id = ?", id);
        for (Integer id : roleIds) {
            jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", id);
            jdbc.update("DELETE FROM roles WHERE id = ?", id);
        }
        for (Integer bookId : bookIds) {
            jdbc.update("DELETE FROM books WHERE id = ?", bookId);
        }
    }

    @Test
    void dynamicStaffPreparesReadyWithExactDeadlineAndLookupIsPrivate() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare");
        int book = createBook(1, 1);
        MvcResult result = createRequest(user, List.of(book), 201);
        String code = loanCode(result);
        int id = itemId(user, book);
        String reference = JsonPath.read(result.getResponse().getContentAsString(), "$.data.pickupReference");
        mvc.perform(get("/api/v1/librarian/pickups/{reference}", reference)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/librarian/pickups/{reference}", reference).header("Authorization", bearer(user)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/librarian/pickups/{reference}", reference).header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.member.id").value(user.memberId()))
                .andExpect(jsonPath("$.data.member.email").doesNotExist());
        transition(staff, code, id, "prepare", 200);
        assertThat(itemStatus(user, book)).isEqualTo("PREPARING");
        transition(staff, code, id, "ready", 200);
        assertThat(itemStatus(user, book)).isEqualTo("READY_FOR_PICKUP");
        assertThat(jdbc.queryForObject("SELECT TIMESTAMPDIFF(SECOND, ready_at, pickup_expires_at) FROM loan_items WHERE id = ?",
                Long.class, id)).isEqualTo(72L * 3600);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id = ? AND notification_kind = 'READY_FOR_PICKUP' AND notification_state = 'PENDING'",
                Integer.class, id)).isEqualTo(1);
        transition(staff, code, id, "ready", 409);
        assertThat(available(book)).isZero();
    }

    @Test
    void exactReadySetAndEveryFeeAreRequiredBeforeAnyPaymentCanCommit() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int first = createBook(1, 1);
        int second = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(first, second), 201));
        int firstId = itemId(user, first);
        int secondId = itemId(user, second);
        for (int id : List.of(firstId, secondId)) {
            transition(staff, code, id, "prepare", 200);
            transition(staff, code, id, "ready", 200);
        }
        handover(staff, code, true, List.of(firstId), "25", 409);
        handover(staff, code, false, List.of(firstId, secondId), "25", 422);
        handover(staff, code, true, List.of(firstId, secondId), "24", 422);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_items WHERE id IN (?, ?) AND paid_borrow_fee IS NOT NULL",
                Integer.class, firstId, secondId)).isZero();
        handover(staff, code, true, List.of(firstId, secondId), "25", 200);
        assertThat(itemStatus(user, first)).isEqualTo("BORROWED");
        assertThat(itemStatus(user, second)).isEqualTo("BORROWED");
        assertThat(jdbc.queryForObject("SELECT DATEDIFF(due_date, DATE(borrowed_at)) FROM loan_items WHERE id = ?",
                Integer.class, firstId)).isEqualTo(14);
        handover(staff, code, true, List.of(firstId, secondId), "25", 409);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id IN (?, ?) AND reason_code = 'HANDOVER_COMPLETED'",
                Integer.class, firstId, secondId)).isEqualTo(2);
        assertThat(available(first)).isZero();
    }

    @Test
    void counterCancelsTwoReadyBeforeCollectingOnlyRemainingZeroFeeItem() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:cancel", "borrow:fee-confirm", "borrow:handover");
        int first = createBook(1, 1);
        int second = createBook(1, 1);
        int third = createBook(1, 1);
        jdbc.update("UPDATE books SET borrow_fee = 0 WHERE id = ?", third);
        String code = loanCode(createRequest(user, List.of(first, second, third), 201));
        for (int book : List.of(first, second, third)) makeReady(staff, user, code, book);
        transition(staff, code, itemId(user, first), "cancel", 200);
        transition(staff, code, itemId(user, second), "cancel", 200);
        handover(staff, code, true, List.of(itemId(user, third)), "0", 200);
        assertThat(itemStatus(user, first)).isEqualTo("CANCELLED");
        assertThat(itemStatus(user, second)).isEqualTo("CANCELLED");
        assertThat(itemStatus(user, third)).isEqualTo("BORROWED");
        assertThat(available(first)).isEqualTo(1);
        assertThat(available(second)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_items WHERE id = ? AND paid_borrow_fee = 0 AND borrow_fee_paid_at IS NOT NULL AND borrow_fee_confirmed_by_account_id IS NOT NULL",
                Integer.class, itemId(user, third))).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_items WHERE id IN (?, ?) AND paid_borrow_fee IS NOT NULL",
                Integer.class, itemId(user, first), itemId(user, second))).isZero();
        transition(staff, code, itemId(user, third), "cancel", 409);
    }

    @Test
    void readyDeadlineIsExclusiveAndReservedOrPreparingCannotBeHandedOver() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        handover(staff, code, true, List.of(id), "25", 409);
        transition(staff, code, id, "prepare", 200);
        handover(staff, code, true, List.of(id), "25", 409);
        transition(staff, code, id, "ready", 200);
        jdbc.update("UPDATE loan_items SET ready_at = ?, pickup_expires_at = ? WHERE id = ?",
                LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC).minusHours(72),
                LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC), id);
        handover(staff, code, true, List.of(id), "25", 409);
        assertThat(itemStatus(user, book)).isEqualTo("READY_FOR_PICKUP");
        assertThat(jdbc.queryForObject("SELECT paid_borrow_fee FROM loan_items WHERE id = ?", BigDecimal.class, id)).isNull();
        jdbc.update("UPDATE loan_items SET pickup_expires_at = DATE_ADD(pickup_expires_at, INTERVAL 1 SECOND) WHERE id = ?", id);
        handover(staff, code, true, List.of(id), "25", 200);
    }

    @Test
    void overdueAndUnpaidLateFeeBlockBothStaffAndAdminUntilResolved() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int first = createBook(1, 1);
        int second = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(first, second), 201));
        makeReady(staff, user, code, second);
        int firstId = itemId(user, first);
        jdbc.update("UPDATE loan_items SET status = 'BORROWED', borrowed_at = '2026-10-01 09:00:00', due_date = '2026-10-18' WHERE id = ?", firstId);
        handover(staff, code, true, List.of(itemId(user, second)), "25", 409);
        handover(adminBearer(), code, true, List.of(itemId(user, second)), "25", 409);
        jdbc.update("UPDATE loan_items SET status = 'RETURNED', returned_at = '2026-10-19 08:00:00', late_fee = 5 WHERE id = ?", firstId);
        handover(staff, code, true, List.of(itemId(user, second)), "25", 409);
        jdbc.update("UPDATE loan_items SET late_fee_paid_at = '2026-10-19 08:30:00' WHERE id = ?", firstId);
        handover(staff, code, true, List.of(itemId(user, second)), "25", 200);
    }

    @Test
    void missingPhysicalCopyIsRejectedWithoutInventingStockAndPreparingWarningIsReadOnly() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare");
        int book = createBook(1, 1);
        MvcResult result = createRequest(user, List.of(book), 201);
        String code = loanCode(result);
        int id = itemId(user, book);
        transition(staff, code, id, "prepare", 200);
        jdbc.update("UPDATE loan_items SET updated_at = '2026-10-18 08:59:59' WHERE id = ?", id);
        String reference = JsonPath.read(result.getResponse().getContentAsString(), "$.data.pickupReference");
        mvc.perform(get("/api/v1/librarian/pickups/{reference}", reference).header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.preparingOverdueItemIds[0]").value(id));
        assertThat(itemStatus(user, book)).isEqualTo("PREPARING");
        transition(staff, code, id, "reject", 200);
        assertThat(itemStatus(user, book)).isEqualTo("REJECTED");
        assertThat(available(book)).isZero();
        mvc.perform(get("/api/v1/librarian/borrow-requests/{code}/history", code).header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(3));
    }

    @Test
    void failureOnSecondItemRollsBackFirstPaymentBorrowingAuditAndHeader() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int first = createBook(1, 1);
        int second = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(first, second), 201));
        makeReady(staff, user, code, first);
        makeReady(staff, user, code, second);
        AtomicInteger called = new AtomicInteger();
        org.mockito.Mockito.doAnswer(invocation -> {
            if (invocation.getArgument(2) == sparkminds.librarymanagement.loan.entity.LoanItemEventReason.HANDOVER_COMPLETED
                    && called.incrementAndGet() == 2) throw new IllegalStateException("Simulated second audit failure");
            return invocation.callRealMethod();
        }).when(auditService).append(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.nullable(sparkminds.librarymanagement.loan.entity.NotificationKind.class),
                org.mockito.ArgumentMatchers.nullable(String.class));
        try {
            handover(staff, code, true, List.of(itemId(user, first), itemId(user, second)), "25", 500);
        } finally {
            org.mockito.Mockito.reset(auditService);
        }
        assertThat(called.get()).isEqualTo(2);
        assertThat(itemStatus(user, first)).isEqualTo("READY_FOR_PICKUP");
        assertThat(itemStatus(user, second)).isEqualTo("READY_FOR_PICKUP");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_items li JOIN loans l ON l.id = li.loan_id WHERE l.loan_code = ? AND (li.paid_borrow_fee IS NOT NULL OR li.borrowed_at IS NOT NULL)", Integer.class, code)).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history h JOIN loan_items li ON li.id = h.loan_item_id JOIN loans l ON l.id = li.loan_id WHERE l.loan_code = ? AND h.reason_code = 'HANDOVER_COMPLETED'", Integer.class, code)).isZero();
        assertThat(jdbc.queryForObject("SELECT borrowed_at FROM loans WHERE loan_code = ?", LocalDateTime.class, code)).isNull();
    }

    @Test
    void handoverLeavesWaitlistedAndPreparingItemsUntouched() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int waiting = createBook(1, 0);
        int preparing = createBook(1, 1);
        int ready = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(waiting, preparing, ready), 201));
        transition(staff, code, itemId(user, preparing), "prepare", 200);
        makeReady(staff, user, code, ready);
        handover(staff, code, true, List.of(itemId(user, ready)), "25", 200);
        assertThat(itemStatus(user, waiting)).isEqualTo("WAITLISTED");
        assertThat(itemStatus(user, preparing)).isEqualTo("PREPARING");
        assertThat(itemStatus(user, ready)).isEqualTo("BORROWED");
        assertThat(jdbc.queryForObject("SELECT status FROM loans WHERE loan_code = ?", String.class, code)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_items WHERE id IN (?, ?) AND paid_borrow_fee IS NOT NULL",
                Integer.class, itemId(user, waiting), itemId(user, preparing))).isZero();
    }

    @Test
    void staffPermissionsAndOwnerEligibilityAreEnforcedWithoutAdminBypass() throws Exception {
        UserFixture user = createUser();
        String readOnly = staffBearer("borrow:read");
        String handoverOnly = staffBearer("borrow:read", "borrow:handover");
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        transition(readOnly, code, id, "prepare", 403);
        handover(handoverOnly, code, true, List.of(id), "25", 403);
        makeReady(staff, user, code, book);
        jdbc.update("UPDATE accounts SET email_verified = false WHERE id = ?", user.accountId());
        handover(staff, code, true, List.of(id), "25", 403);
        handover(adminBearer(), code, true, List.of(id), "25", 403);
        jdbc.update("UPDATE accounts SET email_verified = true, enabled = false WHERE id = ?", user.accountId());
        handover(staff, code, true, List.of(id), "25", 403);
        assertThat(itemStatus(user, book)).isEqualTo("READY_FOR_PICKUP");
        mvc.perform(get("/api/v1/librarian/pickups/{reference}", UUID.randomUUID()).header("Authorization", readOnly))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/librarian/borrow-requests").param("sort", "member.email,asc")
                        .header("Authorization", readOnly)).andExpect(status().isBadRequest());
    }

    @Test
    void duplicateNegativeAndStaleHandoverInputsNeverRecordPayment() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        makeReady(staff, user, code, book);
        handover(staff, code, true, List.of(id, id), "25", 422);
        handover(staff, code, true, List.of(id), "-1", 422);
        // Mã loan vừa được tạo/prepare/ready có version>0; client dùng version0 phải reload.
        long version = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, code);
        String stale = handoverBody(code, List.of(id), "25").replace("\"expectedLoanVersion\":" + version, "\"expectedLoanVersion\":0");
        submitHandover(staff, code, stale).andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT paid_borrow_fee FROM loan_items WHERE id = ?", BigDecimal.class, id)).isNull();
    }

    @Test
    void concurrentHandoverCannotRecordFeesOrAuditTwice() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        makeReady(staff, user, code, book);
        String body = handoverBody(code, List.of(id), "25");
        var responses = race(() -> submitHandover(staff, code, body).andReturn().getResponse().getStatus(),
                () -> submitHandover(staff, code, body).andReturn().getResponse().getStatus());
        assertThat(responses).containsExactlyInAnyOrder(200, 409);
        assertThat(itemStatus(user, book)).isEqualTo("BORROWED");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id = ? AND reason_code = 'HANDOVER_COMPLETED'",
                Integer.class, id)).isEqualTo(1);
        assertThat(available(book)).isZero();
    }

    @Test
    void concurrentOwnCancelAndHandoverHaveOnlyOneWinner() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:fee-confirm", "borrow:handover");
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        makeReady(staff, user, code, book);
        String body = handoverBody(code, List.of(id), "25");
        var responses = race(() -> submitHandover(staff, code, body).andReturn().getResponse().getStatus(),
                () -> mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/cancel", code, id)
                        .header("Authorization", bearer(user))).andReturn().getResponse().getStatus());
        assertThat(responses).containsExactlyInAnyOrder(200, 409);
        if (itemStatus(user, book).equals("BORROWED")) {
            assertThat(responses).containsExactly(200, 409);
            assertThat(available(book)).isZero();
        } else {
            assertThat(responses).containsExactly(409, 200);
            assertThat(itemStatus(user, book)).isEqualTo("CANCELLED");
            assertThat(available(book)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT paid_borrow_fee FROM loan_items WHERE id = ?", BigDecimal.class, id)).isNull();
        }
    }

    @Test
    void userCannotUseStaffLookupEvenWithInjectedStaffPermissionAndStaffListIsPaged() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read");
        int book = createBook(1, 1);
        createRequest(user, List.of(book), 201);
        int roleId = jdbc.queryForObject("SELECT id FROM roles WHERE code = 'USER'", Integer.class);
        int permissionId = jdbc.queryForObject("SELECT id FROM permissions WHERE code = 'borrow:read'", Integer.class);
        int before = jdbc.queryForObject("SELECT COUNT(*) FROM role_permissions WHERE role_id = ? AND permission_id = ?", Integer.class, roleId, permissionId);
        if (before == 0) jdbc.update("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)", roleId, permissionId);
        try {
            mvc.perform(get("/api/v1/librarian/borrow-requests").header("Authorization", bearer(user)))
                    .andExpect(status().isForbidden());
        } finally {
            if (before == 0) jdbc.update("DELETE FROM role_permissions WHERE role_id = ? AND permission_id = ?", roleId, permissionId);
        }
        mvc.perform(get("/api/v1/librarian/borrow-requests").param("status", "RESERVED").param("size", "1")
                        .header("Authorization", staff))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.content.length()").value(1))
                .andExpect(jsonPath("$.data.content[0].member.email").doesNotExist());
        mvc.perform(get("/api/v1/librarian/borrow-requests").param("size", "11").header("Authorization", staff))
                .andExpect(status().isBadRequest());
    }

    private String handoverBody(String code, List<Integer> items, String amount) {
        long version = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, code);
        String payments = items.stream().map(id -> "{\"loanItemId\":" + id + ",\"collectedBorrowFee\":" + amount + "}")
                .collect(java.util.stream.Collectors.joining(","));
        return "{\"identityVerified\":true,\"expectedLoanVersion\":" + version + ",\"items\":[" + payments + "]}";
    }

    private org.springframework.test.web.servlet.ResultActions submitHandover(String staff, String code, String body) throws Exception {
        return mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/handover", code)
                .header("Authorization", staff).contentType(APPLICATION_JSON).content(body));
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

    private void makeReady(String staff, UserFixture user, String code, int book) throws Exception {
        transition(staff, code, itemId(user, book), "prepare", 200);
        transition(staff, code, itemId(user, book), "ready", 200);
    }

    private String adminBearer() {
        Integer id = jdbc.queryForObject("SELECT id FROM accounts WHERE is_system_account = true", Integer.class);
        Long version = jdbc.queryForObject("SELECT session_version FROM accounts WHERE id = ?", Long.class, id);
        return "Bearer " + jwt.issue(id, version, JwtTokenType.ACCESS).value();
    }

    private void transition(String staff, String code, int id, String action, int expected) throws Exception {
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/items/{id}/{action}", code, id, action)
                        .header("Authorization", staff).contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().is(expected));
    }

    private void handover(String staff, String code, boolean identity, List<Integer> items, String amount, int expected) throws Exception {
        long version = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, code);
        String payments = items.stream().map(id -> "{\"loanItemId\":" + id + ",\"collectedBorrowFee\":" + amount + "}")
                .collect(java.util.stream.Collectors.joining(","));
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/handover", code).header("Authorization", staff)
                        .contentType(APPLICATION_JSON).content("{\"identityVerified\":" + identity
                                + ",\"expectedLoanVersion\":" + version + ",\"items\":[" + payments + "]}"))
                .andExpect(status().is(expected));
    }

    private String staffBearer(String... permissions) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO roles (code, display_name, enabled) VALUES (?, ?, true)", "COUNTER_" + suffix, "Counter fixture");
        int roleId = jdbc.queryForObject("SELECT id FROM roles WHERE code = ?", Integer.class, "COUNTER_" + suffix);
        roleIds.add(roleId);
        for (String permission : permissions) jdbc.update("INSERT INTO role_permissions (role_id, permission_id) SELECT ?, id FROM permissions WHERE code = ?", roleId, permission);
        jdbc.update("INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled) VALUES (?, ?, 'fixture-hash', ?, true, true)",
                "st" + suffix, "st" + suffix + "@example.test", roleId);
        int id = jdbc.queryForObject("SELECT id FROM accounts WHERE username = ?", Integer.class, "st" + suffix);
        staffIds.add(id);
        return "Bearer " + jwt.issue(id, 0, JwtTokenType.ACCESS).value();
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
