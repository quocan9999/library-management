package sparkminds.librarymanagement.integration.loan;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenType;
import sparkminds.librarymanagement.auth.security.jwt.JwtTokenService;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Kiểm thử tích hợp toàn diện cho tính năng Giá sách gốc và Tiền cọc mượn sách.
 * Bao gồm:
 * 1. Snapshot giá cọc và tính tổng thanh toán (phí mượn + tiền cọc) khi tạo đơn mượn.
 * 2. Thanh toán mock bao gồm đủ phí mượn và tiền cọc.
 * 3. Hoàn cọc 100% khi trả sách nguyên vẹn tại quầy (bắt buộc thủ thư xác nhận).
 * 4. Báo mất sách: Tịch thu tiền cọc và trừ 1 cuốn khỏi tổng kho sách thư viện.
 * 5. Hoàn tiền tại quầy cho đơn đã thanh toán online bị hủy.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE, printOnlyOnFailure = false)
class BookPriceAndDepositIntegrationTests {

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private JwtTokenService jwt;

    private final List<Integer> accountIds = new ArrayList<>();
    private final List<Integer> bookIds = new ArrayList<>();
    private final List<Integer> roleIds = new ArrayList<>();
    private final List<Integer> staffIds = new ArrayList<>();

    @AfterEach
    void cleanUp() {
        for (Integer accountId : accountIds) {
            jdbc.update("DELETE h FROM loan_item_status_history h JOIN loan_items li ON li.id = h.loan_item_id JOIN loans l ON l.id = li.loan_id JOIN members m ON m.id = l.member_id WHERE m.account_id = ?", accountId);
            jdbc.update("DELETE li FROM loan_items li JOIN loans l ON l.id = li.loan_id JOIN members m ON m.id = l.member_id WHERE m.account_id = ?", accountId);
            jdbc.update("DELETE l FROM loans l JOIN members m ON m.id = l.member_id WHERE m.account_id = ?", accountId);
            jdbc.update("DELETE FROM members WHERE account_id = ?", accountId);
            jdbc.update("DELETE FROM accounts WHERE id = ?", accountId);
        }
        for (Integer staffId : staffIds) {
            jdbc.update("DELETE FROM accounts WHERE id = ?", staffId);
        }
        for (Integer roleId : roleIds) {
            jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", roleId);
            jdbc.update("DELETE FROM roles WHERE id = ?", roleId);
        }
        for (Integer bookId : bookIds) {
            jdbc.update("DELETE FROM books WHERE id = ?", bookId);
        }
    }

    @Test
    @DisplayName("Độc giả tạo đơn mượn: Hệ thống snapshot tiền cọc bằng giá sách gốc và tính tổng thanh toán đúng")
    void reserveOnline_snapshotsDepositAndCalculatesTotalPayment() throws Exception {
        UserFixture user = createUser();
        int bookId = createBookWithPrice("Sách Lập Trình Java", new BigDecimal("15000.00"), new BigDecimal("180000.00"), 5, 5);

        MvcResult result = mvc.perform(post("/api/v1/borrow-requests")
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookIds\":[" + bookId + "]}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("BORROW_REQUEST_CREATED"))
                .andReturn();

        String loanCode = JsonPath.read(result.getResponse().getContentAsString(), "$.data.loanCode");

        // Kiểm tra cơ sở dữ liệu: paymentAmount của đơn mượn = phí mượn (15,000) + tiền cọc (180,000) = 195,000
        BigDecimal paymentAmount = jdbc.queryForObject("SELECT payment_amount FROM loans WHERE loan_code = ?", BigDecimal.class, loanCode);
        assertThat(paymentAmount).isEqualByComparingTo(new BigDecimal("195000.00"));

        // Kiểm tra deposit_amount trong loan_items được snapshot đúng 180,000
        BigDecimal itemDeposit = jdbc.queryForObject("""
                SELECT li.deposit_amount FROM loan_items li JOIN loans l ON l.id = li.loan_id
                WHERE l.loan_code = ? AND li.book_id = ?
                """, BigDecimal.class, loanCode, bookId);
        assertThat(itemDeposit).isEqualByComparingTo(new BigDecimal("180000.00"));
    }

    @Test
    @DisplayName("Thanh toán Mock Payment ghi nhận đúng tiền cọc đã thanh toán (paid_deposit_amount)")
    void mockPayment_recordsPaidDepositAmount() throws Exception {
        UserFixture user = createUser();
        int bookId = createBookWithPrice("Sách Thiết Kế Hệ Thống", new BigDecimal("20000.00"), new BigDecimal("250000.00"), 3, 3);

        MvcResult result = mvc.perform(post("/api/v1/borrow-requests")
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookIds\":[" + bookId + "]}"))
                .andExpect(status().isCreated())
                .andReturn();

        String loanCode = JsonPath.read(result.getResponse().getContentAsString(), "$.data.loanCode");

        // Thanh toán 270,000 (20k phí mượn + 250k cọc)
        long version = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, loanCode);
        mvc.perform(post("/api/v1/borrow-requests/mine/{loanCode}/mock-payment", loanCode)
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"expectedLoanVersion\":" + version + ",\"confirmedAmount\": 270000.00}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PAID"));

        // Kiểm tra paid_deposit_amount trong database
        BigDecimal paidDeposit = jdbc.queryForObject("""
                SELECT li.paid_deposit_amount FROM loan_items li JOIN loans l ON l.id = li.loan_id
                WHERE l.loan_code = ? AND li.book_id = ?
                """, BigDecimal.class, loanCode, bookId);
        assertThat(paidDeposit).isEqualByComparingTo(new BigDecimal("250000.00"));
    }

    @Test
    @DisplayName("Trả sách tại quầy: Hoàn cọc 100% khi sách nguyên vẹn; ném 422 nếu thủ thư chưa xác nhận hoàn cọc")
    void returnBook_requiresDepositRefundConfirmationAndRefunds100Percent() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:handover", "borrow:return", "borrow:fee-confirm");
        int bookId = createBookWithPrice("Sách Clean Architecture", new BigDecimal("10000.00"), new BigDecimal("150000.00"), 2, 2);

        // 1. Tạo đơn mượn & thanh toán
        MvcResult result = mvc.perform(post("/api/v1/borrow-requests")
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookIds\":[" + bookId + "]}"))
                .andExpect(status().isCreated())
                .andReturn();
        String loanCode = JsonPath.read(result.getResponse().getContentAsString(), "$.data.loanCode");
        int itemId = jdbc.queryForObject("SELECT li.id FROM loan_items li JOIN loans l ON l.id = li.loan_id WHERE l.loan_code = ?", Integer.class, loanCode);

        long version = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, loanCode);
        mvc.perform(post("/api/v1/borrow-requests/mine/{loanCode}/mock-payment", loanCode)
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"expectedLoanVersion\":" + version + ",\"confirmedAmount\": 160000.00}"))
                .andExpect(status().isOk());

        // 2. Chuẩn bị và bàn giao sách
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/items/{id}/prepare", loanCode, itemId)
                .header("Authorization", staff)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/items/{id}/ready", loanCode, itemId)
                .header("Authorization", staff)).andExpect(status().isOk());
        long vHandover = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, loanCode);
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/handover", loanCode)
                .header("Authorization", staff)
                .contentType(APPLICATION_JSON)
                .content("{\"identityVerified\": true, \"expectedLoanVersion\": " + vHandover + ", \"items\": []}")).andExpect(status().isOk());

        // 3. Trả sách nhưng chưa xác nhận hoàn cọc -> ném 422
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/return", loanCode)
                        .header("Authorization", staff)
                        .contentType(APPLICATION_JSON)
                        .content("{\"itemIds\":[" + itemId + "],\"physicalBookReceived\":true,\"depositRefunded\":false}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("hoàn trả tiền cọc")));

        // 4. Trả sách có xác nhận hoàn cọc -> Thành công
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/return", loanCode)
                        .header("Authorization", staff)
                        .contentType(APPLICATION_JSON)
                        .content("{\"itemIds\":[" + itemId + "],\"physicalBookReceived\":true,\"depositRefunded\":true}"))
                .andExpect(status().isOk());

        // Kiểm tra database: hoàn đủ 150k cọc, tồn kho khả dụng tăng lại 2
        BigDecimal refundedDeposit = jdbc.queryForObject("SELECT deposit_refunded_amount FROM loan_items WHERE id = ?", BigDecimal.class, itemId);
        assertThat(refundedDeposit).isEqualByComparingTo(new BigDecimal("150000.00"));
        int availableQty = jdbc.queryForObject("SELECT available_quantity FROM books WHERE id = ?", Integer.class, bookId);
        assertThat(availableQty).isEqualTo(2);
    }

    @Test
    @DisplayName("Báo mất sách (LOST): Tịch thu tiền cọc và khấu trừ 1 cuốn khỏi tổng số lượng sách thư viện (total_quantity - 1)")
    void reportLostBook_forfeitsDepositAndDecrementsTotalQuantity() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:prepare", "borrow:handover", "borrow:return", "borrow:fee-confirm");
        int bookId = createBookWithPrice("Sách Mất Sách Test", new BigDecimal("10000.00"), new BigDecimal("200000.00"), 4, 4);

        // Tạo đơn & thanh toán & bàn giao
        MvcResult result = mvc.perform(post("/api/v1/borrow-requests")
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookIds\":[" + bookId + "]}"))
                .andExpect(status().isCreated())
                .andReturn();
        String loanCode = JsonPath.read(result.getResponse().getContentAsString(), "$.data.loanCode");
        int itemId = jdbc.queryForObject("SELECT li.id FROM loan_items li JOIN loans l ON l.id = li.loan_id WHERE l.loan_code = ?", Integer.class, loanCode);

        long version = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, loanCode);
        mvc.perform(post("/api/v1/borrow-requests/mine/{loanCode}/mock-payment", loanCode)
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"expectedLoanVersion\":" + version + ",\"confirmedAmount\": 210000.00}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/items/{id}/prepare", loanCode, itemId)
                .header("Authorization", staff)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/items/{id}/ready", loanCode, itemId)
                .header("Authorization", staff)).andExpect(status().isOk());
        long vHandover = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, loanCode);
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/handover", loanCode)
                .header("Authorization", staff)
                .contentType(APPLICATION_JSON)
                .content("{\"identityVerified\": true, \"expectedLoanVersion\": " + vHandover + ", \"items\": []}")).andExpect(status().isOk());

        // Báo mất sách tại quầy
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/report-lost", loanCode)
                        .header("Authorization", staff)
                        .contentType(APPLICATION_JSON)
                        .content("{\"itemIds\":[" + itemId + "]}"))
                .andExpect(status().isOk());

        // Kiểm tra database:
        // 1. Trạng thái item chuyển sang LOST, deposit_forfeited_at có giá trị, deposit_refunded_amount = 0
        String itemStatus = jdbc.queryForObject("SELECT status FROM loan_items WHERE id = ?", String.class, itemId);
        assertThat(itemStatus).isEqualTo("LOST");
        BigDecimal refundedDeposit = jdbc.queryForObject("SELECT deposit_refunded_amount FROM loan_items WHERE id = ?", BigDecimal.class, itemId);
        assertThat(refundedDeposit).isEqualByComparingTo(BigDecimal.ZERO);

        // 2. Tổng kho sách (total_quantity) giảm 1 (từ 4 còn 3), khả dụng không đổi (vẫn 3 vì lúc mượn đã trừ 1)
        int totalQty = jdbc.queryForObject("SELECT total_quantity FROM books WHERE id = ?", Integer.class, bookId);
        int availableQty = jdbc.queryForObject("SELECT available_quantity FROM books WHERE id = ?", Integer.class, bookId);
        assertThat(totalQty).isEqualTo(3);
        assertThat(availableQty).isEqualTo(3);
    }

    @Test
    @DisplayName("Hoàn tiền tại quầy cho đơn đã thanh toán online bị hủy: Hoàn đủ 100% (cọc + phí)")
    void confirmOfflineRefund_refundsFullPaymentForCancelledPaidLoan() throws Exception {
        UserFixture user = createUser();
        String staff = staffBearer("borrow:read", "borrow:return");
        int bookId = createBookWithPrice("Sách Đơn Hủy Test", new BigDecimal("12000.00"), new BigDecimal("150000.00"), 2, 2);

        // Tạo đơn & thanh toán online
        MvcResult result = mvc.perform(post("/api/v1/borrow-requests")
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"bookIds\":[" + bookId + "]}"))
                .andExpect(status().isCreated())
                .andReturn();
        String loanCode = JsonPath.read(result.getResponse().getContentAsString(), "$.data.loanCode");
        int itemId = jdbc.queryForObject("SELECT li.id FROM loan_items li JOIN loans l ON l.id = li.loan_id WHERE l.loan_code = ?", Integer.class, loanCode);

        long version = jdbc.queryForObject("SELECT version FROM loans WHERE loan_code = ?", Long.class, loanCode);
        mvc.perform(post("/api/v1/borrow-requests/mine/{loanCode}/mock-payment", loanCode)
                        .header("Authorization", bearer(user))
                        .contentType(APPLICATION_JSON)
                        .content("{\"expectedLoanVersion\":" + version + ",\"confirmedAmount\": 162000.00}"))
                .andExpect(status().isOk());

        // Đơn mượn bị hủy / hết hạn (tất cả sách trong đơn không còn ở trạng thái active)
        jdbc.update("UPDATE loan_items SET status = 'CANCELLED' WHERE id = ?", itemId);
        jdbc.update("UPDATE loans SET status = 'CLOSED' WHERE loan_code = ?", loanCode);

        // Thủ thư xác nhận hoàn tiền tại quầy cho độc giả
        mvc.perform(post("/api/v1/librarian/borrow-requests/{code}/confirm-refund", loanCode)
                        .header("Authorization", staff))
                .andExpect(status().isOk());

        // Kiểm tra database: refunded_amount = 162,000, refunded_at != null
        BigDecimal refundedAmount = jdbc.queryForObject("SELECT refunded_amount FROM loans WHERE loan_code = ?", BigDecimal.class, loanCode);
        assertThat(refundedAmount).isEqualByComparingTo(new BigDecimal("162000.00"));
    }

    private int createBookWithPrice(String title, BigDecimal borrowFee, BigDecimal price, int total, int available) {
        String code = "BK-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO books (book_code, title, author, total_quantity, available_quantity, borrow_fee, price, late_fee_per_day)
                VALUES (?, ?, 'Tác giả mẫu', ?, ?, ?, ?, 5000.00)
                """, code, title, total, available, borrowFee, price);
        int id = jdbc.queryForObject("SELECT id FROM books WHERE book_code = ?", Integer.class, code);
        bookIds.add(id);
        return id;
    }

    private String staffBearer(String... permissions) {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("INSERT INTO roles (code, display_name, enabled) VALUES (?, ?, true)", "STAFF_" + suffix, "Staff fixture");
        int roleId = jdbc.queryForObject("SELECT id FROM roles WHERE code = ?", Integer.class, "STAFF_" + suffix);
        roleIds.add(roleId);
        for (String permission : permissions) {
            jdbc.update("INSERT INTO role_permissions (role_id, permission_id) SELECT ?, id FROM permissions WHERE code = ?", roleId, permission);
        }
        jdbc.update("INSERT INTO accounts (username, email, password_hash, role_id, email_verified, enabled) VALUES (?, ?, 'fixture-hash', ?, true, true)",
                "st" + suffix, "st" + suffix + "@example.test", roleId);
        int id = jdbc.queryForObject("SELECT id FROM accounts WHERE username = ?", Integer.class, "st" + suffix);
        staffIds.add(id);
        return "Bearer " + jwt.issue(id, 0, JwtTokenType.ACCESS).value();
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
                VALUES (?, ?, 'Độc giả mẫu', '1995-05-15')
                """, accountId, "MB-" + suffix);
        int memberId = jdbc.queryForObject("SELECT id FROM members WHERE account_id = ?", Integer.class, accountId);
        return new UserFixture(accountId, memberId, jwt.issue(accountId, 0, JwtTokenType.ACCESS).value());
    }

    private record UserFixture(int accountId, int memberId, String token) {
    }
}
