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

/** Fixture được commit riêng vì mỗi attempt Borrow phải mở transaction mới, không đọc dữ liệu test chưa commit. */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
class BorrowReservationIntegrationTests {

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JwtTokenService jwt;

    @Autowired private BorrowRetryExecutor retryExecutor;
    @Autowired private EntityManager entityManager;
    @Autowired private EntityManagerFactory entityManagerFactory;

    private final List<Integer> accountIds = new ArrayList<>();
    private final List<Integer> bookIds = new ArrayList<>();

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
    void userCatalogReusesSearchWithoutOpeningAdminEndpointOrExposingPrivateFields() throws Exception {
        UserFixture user = createUser();
        int bookId = createBook(2, 1);
        mvc.perform(get("/api/v1/catalog/books/{id}", bookId).header("Authorization", bearer(user)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("BOOK_CATALOG_DETAIL_SUCCESS"))
                .andExpect(jsonPath("$.data.waitlistCount").value(0))
                .andExpect(jsonPath("$.data.waitlistCap").value(8))
                .andExpect(jsonPath("$.data.version").doesNotExist())
                .andExpect(jsonPath("$.data.coverImagePublicId").doesNotExist());
        String code = jdbc.queryForObject("SELECT book_code FROM books WHERE id = ?", String.class, bookId);
        mvc.perform(get("/api/v1/catalog/books").param("q", code).header("Authorization", bearer(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1));
        mvc.perform(get("/api/v1/books").header("Authorization", bearer(user)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/catalog/books")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/catalog/books").param("sort", "title;drop table books,asc")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void oneRequestReservesAvailableBooksAndWaitlistsOtherBooksWithDurableIntentAndFeeSnapshots() throws Exception {
        UserFixture user = createUser();
        int available = createBook(1, 1);
        int unavailable = createBook(1, 0);
        int third = createBook(1, 1);
        Instant before = Instant.now().minusSeconds(1);
        MvcResult created = createRequest(user, List.of(available, unavailable, third), 201);
        String code = loanCode(created);
        LocalDateTime createdAt = jdbc.queryForObject("SELECT created_at FROM loans WHERE loan_code = ?",
                LocalDateTime.class, code);
        assertThat(createdAt.toInstant(ZoneOffset.UTC)).isBetween(before, Instant.now().plusSeconds(1));
        assertThat(created.getResponse().getHeader("Location"))
                .isEqualTo("/api/v1/borrow-requests/mine/" + code);
        assertThat(UUID.fromString(JsonPath.read(created.getResponse().getContentAsString(), "$.data.pickupReference"))
                .version()).isEqualTo(4);
        assertThat(itemStatus(user, available)).isEqualTo("RESERVED");
        assertThat(itemStatus(user, unavailable)).isEqualTo("WAITLISTED");
        assertThat(available(available)).isZero();
        assertThat(available(unavailable)).isZero();
        assertThat(available(third)).isZero();
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM loan_item_status_history h JOIN loan_items li ON li.id = h.loan_item_id
                JOIN loans l ON l.id = li.loan_id WHERE l.member_id = ? AND h.reason_code = 'REQUEST_CREATED'
                """, Integer.class, user.memberId())).isEqualTo(3);
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM loan_item_status_history h JOIN loan_items li ON li.id = h.loan_item_id
                JOIN loans l ON l.id = li.loan_id WHERE l.member_id = ?
                AND h.notification_kind = 'REQUEST_CREATED' AND h.notification_state = 'PENDING'
                """, Integer.class, user.memberId())).isEqualTo(1);
        jdbc.update("UPDATE books SET borrow_fee = 99, late_fee_per_day = 9 WHERE id = ?", unavailable);
        assertThat(jdbc.queryForObject("""
                SELECT li.borrow_fee FROM loan_items li JOIN loans l ON l.id = li.loan_id
                WHERE l.member_id = ? AND li.book_id = ?
                """, BigDecimal.class, user.memberId(), unavailable)).isEqualByComparingTo("25.00");
        mvc.perform(get("/api/v1/borrow-requests/mine/{code}", code).header("Authorization", bearer(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("OPEN"))
                .andExpect(jsonPath("$.data.items.length()").value(3));
    }

    @Test
    void invalidRequestsAndMissingBookNeverLeavePartialLoanInventoryOrAudit() throws Exception {
        UserFixture user = createUser();
        List<Integer> books = List.of(createBook(1, 1), createBook(1, 1), createBook(1, 1), createBook(1, 1));
        createRequest(user, List.of(), 422);
        createRequest(user, books, 422);
        createRequest(user, List.of(books.get(0), books.get(0)), 422);
        createRequest(user, List.of(-1), 422);
        createRequest(user, List.of(books.get(0), Integer.MAX_VALUE), 404);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loans WHERE member_id = ?", Integer.class, user.memberId()))
                .isZero();
        for (Integer bookId : books) assertThat(available(bookId)).isEqualTo(1);
    }

    @Test
    void authorizationAndOwnershipAreEnforcedByBackend() throws Exception {
        UserFixture owner = createUser();
        UserFixture stranger = createUser();
        int book = createBook(1, 1);
        mvc.perform(post("/api/v1/borrow-requests").contentType(APPLICATION_JSON).content(body(List.of(book))))
                .andExpect(status().isUnauthorized());
        Integer adminId = jdbc.queryForObject("SELECT id FROM accounts WHERE is_system_account = true", Integer.class);
        Long version = jdbc.queryForObject("SELECT session_version FROM accounts WHERE id = ?", Long.class, adminId);
        mvc.perform(post("/api/v1/borrow-requests")
                        .header("Authorization", "Bearer " + jwt.issue(adminId, version, JwtTokenType.ACCESS).value())
                        .contentType(APPLICATION_JSON).content(body(List.of(book))))
                .andExpect(status().isForbidden());
        String code = loanCode(createRequest(owner, List.of(book), 201));
        mvc.perform(get("/api/v1/borrow-requests/mine/{code}", code).header("Authorization", bearer(stranger)))
                .andExpect(status().isNotFound());
        Integer itemId = jdbc.queryForObject("SELECT li.id FROM loan_items li JOIN loans l ON l.id = li.loan_id WHERE l.loan_code = ?",
                Integer.class, code);
        mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/cancel", code, itemId)
                        .header("Authorization", bearer(stranger)).contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isNotFound());
        assertThat(itemStatus(owner, book)).isEqualTo("RESERVED");
    }

    @Test
    void cancellingAReservationPromotesFifoWithoutSkippingAnOverdueHeadOrChangingSnapshots() throws Exception {
        UserFixture holder = createUser();
        UserFixture first = createUser();
        UserFixture second = createUser();
        int book = createBook(1, 1);
        String holderCode = loanCode(createRequest(holder, List.of(book), 201));
        createRequest(first, List.of(book), 201);
        String secondCode = loanCode(createRequest(second, List.of(book), 201));
        jdbc.update("UPDATE loan_items SET waitlisted_at = '2026-10-19 00:00:00' WHERE book_id = ? AND status = 'WAITLISTED'", book);
        int overdueBook = createBook(1, 1);
        createRequest(first, List.of(overdueBook), 201);
        jdbc.update("""
                UPDATE loan_items li JOIN loans l ON l.id = li.loan_id
                SET li.status = 'BORROWED', li.borrowed_at = DATE_SUB(UTC_TIMESTAMP, INTERVAL 20 DAY),
                    li.due_date = DATE_SUB(UTC_DATE, INTERVAL 6 DAY)
                WHERE l.member_id = ? AND li.book_id = ?
                """, first.memberId(), overdueBook);
        jdbc.update("UPDATE books SET borrow_fee = 99, late_fee_per_day = 9, version = version + 1 WHERE id = ?", book);
        cancel(holder, holderCode, itemId(holder, book), 200);
        assertThat(itemStatus(first, book)).isEqualTo("RESERVED");
        assertThat(itemStatus(second, book)).isEqualTo("WAITLISTED");
        assertThat(available(book)).isZero();
        assertThat(jdbc.queryForObject("SELECT borrow_fee FROM loan_items WHERE id = ?", BigDecimal.class,
                itemId(first, book))).isEqualByComparingTo("25.00");
        mvc.perform(get("/api/v1/borrow-requests/mine/{code}", secondCode).header("Authorization", bearer(second)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.items[0].waitlistPosition").value(1))
                .andExpect(jsonPath("$.data.items[0].waitlistTotal").value(1));
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM loan_item_status_history WHERE loan_item_id = ?
                AND reason_code = 'QUEUE_PROMOTED' AND notification_key IS NULL AND notification_state IS NULL
                """, Integer.class, itemId(first, book))).isEqualTo(1);
        cancel(holder, holderCode, itemId(holder, book), 409);
        assertThat(available(book)).isZero();
    }

    @Test
    void cancellingWaitlistedAndReadyItemsDoesNotDoubleReleaseInventory() throws Exception {
        UserFixture holder = createUser();
        UserFixture waiter = createUser();
        int book = createBook(1, 1);
        String holderCode = loanCode(createRequest(holder, List.of(book), 201));
        String waitingCode = loanCode(createRequest(waiter, List.of(book), 201));
        cancel(waiter, waitingCode, itemId(waiter, book), 200);
        assertThat(available(book)).isZero();
        assertThat(itemStatus(waiter, book)).isEqualTo("CANCELLED");
        jdbc.update("""
                UPDATE loan_items SET status = 'READY_FOR_PICKUP', ready_at = DATE_SUB(UTC_TIMESTAMP, INTERVAL 1 HOUR),
                pickup_expires_at = DATE_ADD(UTC_TIMESTAMP, INTERVAL 71 HOUR) WHERE id = ?
                """, itemId(holder, book));
        cancel(holder, holderCode, itemId(holder, book), 200);
        assertThat(available(book)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM loans WHERE loan_code = ?", String.class, holderCode))
                .isEqualTo("CLOSED");
        cancel(holder, holderCode, itemId(holder, book), 409);
        assertThat(available(book)).isEqualTo(1);
    }

    @Test
    void activeLimitAndDuplicateTitleApplyAcrossRequestsAndFailedBatchRollsBack() throws Exception {
        UserFixture user = createUser();
        int first = createBook(1, 1);
        int second = createBook(1, 1);
        int third = createBook(1, 1);
        int fourth = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(first, second), 201));
        MvcResult duplicate = createRequest(user, List.of(first), 409);
        assertThat(JsonPath.<String>read(duplicate.getResponse().getContentAsString(), "$.code"))
                .isEqualTo("BORROW_DUPLICATE_ACTIVE_BOOK");
        createRequest(user, List.of(third, fourth), 409);
        assertThat(available(third)).isEqualTo(1);
        assertThat(available(fourth)).isEqualTo(1);
        createRequest(user, List.of(third), 201);
        createRequest(user, List.of(fourth), 409);
        cancel(user, code, itemId(user, first), 200);
        createRequest(user, List.of(first), 201);
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM loan_items li JOIN loans l ON l.id = li.loan_id
                WHERE l.member_id = ? AND li.status = 'RESERVED'
                """, Integer.class, user.memberId())).isEqualTo(3);
    }

    @Test
    void waitlistCapAndZeroQuantityRejectWholeRequestWithoutPartialStockChange() throws Exception {
        int spare = createBook(1, 1);
        int queuedBook = createBook(1, 0);
        for (int index = 0; index < 4; index++) createRequest(createUser(), List.of(queuedBook), 201);
        UserFixture excess = createUser();
        MvcResult full = createRequest(excess, List.of(spare, queuedBook), 409);
        assertThat(JsonPath.<String>read(full.getResponse().getContentAsString(), "$.code")).isEqualTo("BORROW_WAITLIST_FULL");
        assertThat(available(spare)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loans WHERE member_id = ?", Integer.class, excess.memberId()))
                .isZero();
        createRequest(excess, List.of(createBook(0, 0)), 409);
    }

    @Test
    void adminStockIncreaseAllocatesOldestWaitingItemBeforeNewReservations() throws Exception {
        UserFixture first = createUser();
        UserFixture second = createUser();
        int book = createBook(1, 0);
        createRequest(first, List.of(book), 201);
        createRequest(second, List.of(book), 201);
        jdbc.update("UPDATE loan_items SET waitlisted_at = '2026-10-19 00:00:00' WHERE book_id = ?", book);
        updateStock(book, 2);
        assertThat(itemStatus(first, book)).isEqualTo("RESERVED");
        assertThat(itemStatus(second, book)).isEqualTo("WAITLISTED");
        assertThat(available(book)).isZero();
        UserFixture newcomer = createUser();
        createRequest(newcomer, List.of(book), 201);
        assertThat(itemStatus(newcomer, book)).isEqualTo("WAITLISTED");
    }

    @Test
    void disablingActiveMemberIsConflictWithoutRevocationButClosedHistoryAllowsDisable() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        mvc.perform(patch("/api/v1/members/{id}/account-status", user.memberId()).header("Authorization", adminBearer())
                        .contentType(APPLICATION_JSON).content("{\"expectedEnabled\":true,\"enabled\":false}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("MEMBER_HAS_ACTIVE_BORROW_ACTIVITY"));
        assertThat(jdbc.queryForObject("SELECT enabled FROM accounts WHERE id = ?", Boolean.class, user.accountId())).isTrue();
        assertThat(jdbc.queryForObject("SELECT session_version FROM accounts WHERE id = ?", Long.class, user.accountId())).isZero();
        cancel(user, code, itemId(user, book), 200);
        mvc.perform(patch("/api/v1/members/{id}/account-status", user.memberId()).header("Authorization", adminBearer())
                        .contentType(APPLICATION_JSON).content("{\"expectedEnabled\":true,\"enabled\":false}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/borrow-requests/mine/{code}", code).header("Authorization", bearer(user)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("AUTH_ACCOUNT_DISABLED"));
    }

    @Test
    void mineListFiltersItemsBeforePaginationAndOwnHistoryDoesNotExposeActorIds() throws Exception {
        UserFixture user = createUser();
        UserFixture stranger = createUser();
        int reserved = createBook(1, 1);
        int waiting = createBook(1, 0);
        String mixedCode = loanCode(createRequest(user, List.of(reserved, waiting), 201));
        createRequest(user, List.of(createBook(1, 1)), 201);
        mvc.perform(get("/api/v1/borrow-requests/mine").param("status", "WAITLISTED")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].loanCode").value(mixedCode))
                .andExpect(jsonPath("$.data.content[0].aggregateStatus").value("OPEN"));
        mvc.perform(get("/api/v1/borrow-requests/mine").param("status", "PENDING").param("size", "1")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.content.length()").value(1));
        int waitingId = itemId(user, waiting);
        cancel(user, mixedCode, waitingId, 200);
        mvc.perform(get("/api/v1/borrow-requests/mine").param("status", "HISTORY")
                        .header("Authorization", bearer(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.content[0].aggregateStatus").value("OPEN"));
        mvc.perform(get("/api/v1/borrow-requests/mine/{code}/items/{id}/history", mixedCode, waitingId)
                        .param("size", "1").header("Authorization", bearer(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.totalElements").value(2))
                .andExpect(jsonPath("$.data.content[0].reasonCode").value("REQUEST_CREATED"))
                .andExpect(jsonPath("$.data.content[0].actorAccountId").doesNotExist())
                .andExpect(jsonPath("$.data.content[0].pickupReference").doesNotExist());
        mvc.perform(get("/api/v1/borrow-requests/mine/{code}/items/{id}/history", mixedCode, waitingId)
                        .header("Authorization", bearer(stranger)))
                .andExpect(status().isNotFound());
        for (String invalid : List.of("size=11", "page=-1", "status=INVALID", "sort=title,desc")) {
            String[] parts = invalid.split("=");
            mvc.perform(get("/api/v1/borrow-requests/mine").param(parts[0], parts[1])
                            .header("Authorization", bearer(user)))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void preparingIsCancellableButBorrowedReturnedAndExpiredReadyAreNot() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String code = loanCode(createRequest(user, List.of(book), 201));
        int id = itemId(user, book);
        jdbc.update("UPDATE loan_items SET status = 'PREPARING' WHERE id = ?", id);
        cancel(user, code, id, 200);
        assertThat(available(book)).isEqualTo(1);

        int borrowed = createBook(1, 1);
        String borrowedCode = loanCode(createRequest(user, List.of(borrowed), 201));
        int borrowedId = itemId(user, borrowed);
        jdbc.update("""
                UPDATE loan_items SET status = 'BORROWED', borrowed_at = DATE_SUB(UTC_TIMESTAMP, INTERVAL 1 DAY),
                due_date = DATE_ADD(UTC_DATE, INTERVAL 13 DAY) WHERE id = ?
                """, borrowedId);
        cancel(user, borrowedCode, borrowedId, 409);
        assertThat(available(borrowed)).isZero();
        jdbc.update("UPDATE loan_items SET status = 'RETURNED', returned_at = UTC_TIMESTAMP WHERE id = ?", borrowedId);
        jdbc.update("UPDATE books SET available_quantity = 1 WHERE id = ?", borrowed);
        cancel(user, borrowedCode, borrowedId, 409);
        assertThat(available(borrowed)).isEqualTo(1);

        int expired = createBook(1, 1);
        String expiredCode = loanCode(createRequest(user, List.of(expired), 201));
        int expiredId = itemId(user, expired);
        jdbc.update("""
                UPDATE loan_items SET status = 'READY_FOR_PICKUP', ready_at = DATE_SUB(UTC_TIMESTAMP, INTERVAL 73 HOUR),
                pickup_expires_at = DATE_SUB(UTC_TIMESTAMP, INTERVAL 1 HOUR) WHERE id = ?
                """, expiredId);
        mvc.perform(post("/api/v1/borrow-requests/mine/{code}/items/{id}/cancel", expiredCode, expiredId)
                        .header("Authorization", bearer(user)).contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BORROW_PICKUP_EXPIRED"));
        assertThat(available(expired)).isZero();
    }

    @Test
    void concurrentRequestsForLastCopyReserveExactlyOneAndWaitlistTheOther() throws Exception {
        UserFixture first = createUser();
        UserFixture second = createUser();
        int book = createBook(1, 1);
        race(() -> createRequest(first, List.of(book), 201),
                () -> createRequest(second, List.of(book), 201));
        assertThat(List.of(itemStatus(first, book), itemStatus(second, book)))
                .containsExactlyInAnyOrder("RESERVED", "WAITLISTED");
        assertThat(available(book)).isZero();
    }

    @Test
    void concurrentRequestsForSameMemberCannotExceedGlobalLimit() throws Exception {
        UserFixture user = createUser();
        createRequest(user, List.of(createBook(1, 1), createBook(1, 1)), 201);
        int first = createBook(1, 1);
        int second = createBook(1, 1);
        var responses = race(() -> requestStatus(user, first), () -> requestStatus(user, second));
        assertThat(responses).containsExactlyInAnyOrder(201, 409);
        assertThat(jdbc.queryForObject("""
                SELECT COUNT(*) FROM loan_items li JOIN loans l ON l.id = li.loan_id
                WHERE l.member_id = ? AND li.status = 'RESERVED'
                """, Integer.class, user.memberId())).isEqualTo(3);
        assertThat(available(first) + available(second)).isEqualTo(1);
    }

    @Test
    void concurrentStockIncreaseCannotLetNewcomerBypassQueueHead() throws Exception {
        UserFixture head = createUser();
        UserFixture newcomer = createUser();
        int book = createBook(1, 0);
        createRequest(head, List.of(book), 201);
        race(() -> { updateStock(book, 2); return 200; },
                () -> requestStatus(newcomer, book));
        assertThat(itemStatus(head, book)).isEqualTo("RESERVED");
        assertThat(itemStatus(newcomer, book)).isEqualTo("WAITLISTED");
        assertThat(available(book)).isZero();
    }

    @Test
    void concurrentDisableAndReservationHaveOnlyValidSerializedOutcomes() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String admin = adminBearer();
        var responses = race(() -> requestStatus(user, book), () -> mvc.perform(
                patch("/api/v1/members/{id}/account-status", user.memberId())
                        .header("Authorization", admin).contentType(APPLICATION_JSON)
                        .content("{\"expectedEnabled\":true,\"enabled\":false}"))
                .andReturn().getResponse().getStatus());
        boolean enabled = jdbc.queryForObject("SELECT enabled FROM accounts WHERE id = ?", Boolean.class, user.accountId());
        if (enabled) {
            assertThat(responses).containsExactly(201, 409);
            assertThat(itemStatus(user, book)).isEqualTo("RESERVED");
        } else {
            assertThat(responses).containsExactly(403, 200);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM loans WHERE member_id = ?",
                    Integer.class, user.memberId())).isZero();
            assertThat(available(book)).isEqualTo(1);
        }
    }

    @Test
    void concurrentMemberDeletionAndReservationPreserveHistoryWithoutDeadlock() throws Exception {
        UserFixture user = createUser();
        int book = createBook(1, 1);
        String admin = adminBearer();
        var responses = race(() -> requestStatus(user, book), () -> mvc.perform(
                delete(
                        "/api/v1/members/{id}", user.memberId()).header("Authorization", admin))
                .andReturn().getResponse().getStatus());
        if (responses.get(0) == 201) {
            assertThat(responses.get(1)).isEqualTo(409);
            assertThat(itemStatus(user, book)).isEqualTo("RESERVED");
        } else {
            assertThat(responses.get(0)).isIn(401, 403);
            assertThat(responses.get(1)).isEqualTo(200);
            assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM members WHERE id = ?",
                    Integer.class, user.memberId())).isZero();
            assertThat(available(book)).isEqualTo(1);
        }
    }

    private int requestStatus(UserFixture user, int book) throws Exception {
        return mvc.perform(post("/api/v1/borrow-requests").header("Authorization", bearer(user))
                .contentType(APPLICATION_JSON).content(body(List.of(book))))
                .andReturn().getResponse().getStatus();
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

    @Test
    void optimisticRetryUsesFreshPersistenceContextsAndRollsBackEveryFailedAttempt() {
        int bookId = createBook(1, 1);
        var view = entityManagerFactory.createEntityManager();
        var holder = new EntityManagerHolder(view);
        var contexts = Collections.newSetFromMap(new IdentityHashMap<Object, Boolean>());
        var attempts = new AtomicInteger();
        var staleView = view.find(Book.class, bookId);
        TransactionSynchronizationManager.bindResource(entityManagerFactory, holder);
        try {
            retryExecutor.execute(() -> {
                contexts.add(entityManager.getDelegate());
                var book = entityManager.find(Book.class, bookId);
                assertThat(book.getVersion()).isZero();
                if (attempts.incrementAndGet() == 1) {
                    jdbc.update("UPDATE books SET version = version + 1 WHERE id = ?", bookId);
                }
                book.setAvailableQuantity(0);
                entityManager.flush();
                return null;
            });
            assertThat(attempts.get()).isEqualTo(2);
            assertThat(contexts).hasSize(2).doesNotContain(view);
            assertThat(available(bookId)).isZero();
            assertThat(jdbc.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, bookId)).isEqualTo(1L);
            assertThat(staleView.getVersion()).isZero();
            assertThat(TransactionSynchronizationManager.getResource(entityManagerFactory))
                    .isSameAs(holder);

            int exhaustedBook = createBook(1, 1);
            attempts.set(0);
            assertThatThrownBy(() -> retryExecutor.execute(() -> {
                attempts.incrementAndGet();
                var book = entityManager.find(Book.class, exhaustedBook);
                jdbc.update("UPDATE books SET version = version + 1 WHERE id = ?", exhaustedBook);
                book.setAvailableQuantity(0);
                entityManager.flush();
                return null;
            })).isInstanceOfSatisfying(BusinessException.class,
                    error -> assertThat(error.getCode()).isEqualTo("BORROW_VERSION_CONFLICT"));
            assertThat(attempts.get()).isEqualTo(3);
            assertThat(available(exhaustedBook)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, exhaustedBook)).isZero();
        } finally {
            TransactionSynchronizationManager.unbindResource(entityManagerFactory);
            view.close();
        }
    }

    private void updateStock(int bookId, int total) throws Exception {
        String title = jdbc.queryForObject("SELECT title FROM books WHERE id = ?", String.class, bookId);
        long version = jdbc.queryForObject("SELECT version FROM books WHERE id = ?", Long.class, bookId);
        String body = "{\"title\":\"" + title + "\",\"author\":\"Borrow fixture\",\"totalQuantity\":" + total
                + ",\"borrowFee\":99,\"lateFeePerDay\":9,\"version\":" + version + "}";
        mvc.perform(put("/api/v1/books/{id}", bookId).header("Authorization", adminBearer())
                .contentType(APPLICATION_JSON).content(body)).andExpect(status().isOk());
    }

    private String adminBearer() {
        Integer id = jdbc.queryForObject("SELECT id FROM accounts WHERE is_system_account = true", Integer.class);
        Long version = jdbc.queryForObject("SELECT session_version FROM accounts WHERE id = ?", Long.class, id);
        return "Bearer " + jwt.issue(id, version, JwtTokenType.ACCESS).value();
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
