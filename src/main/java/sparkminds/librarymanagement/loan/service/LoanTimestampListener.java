package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanItem;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Chỉ timestamp của Borrow dùng Clock UTC; không đổi timezone toàn app hoặc diễn giải lại metadata legacy. */
@Component
@RequiredArgsConstructor
public class LoanTimestampListener {

    private final Clock clock;

    @PrePersist
    public void created(Object entity) {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (entity instanceof Loan loan) {
            if (loan.getCreatedAt() == null) loan.setCreatedAt(now);
            loan.setUpdatedAt(now);
        } else if (entity instanceof LoanItem item) {
            if (item.getCreatedAt() == null) item.setCreatedAt(now);
            item.setUpdatedAt(now);
        }
    }

    @PreUpdate
    public void updated(Object entity) {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        if (entity instanceof Loan loan) loan.setUpdatedAt(now);
        else if (entity instanceof LoanItem item) item.setUpdatedAt(now);
    }
}
