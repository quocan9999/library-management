package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import sparkminds.librarymanagement.loan.entity.Loan;
import sparkminds.librarymanagement.loan.entity.LoanItem;
import sparkminds.librarymanagement.loan.repository.LoanItemRepository;
import sparkminds.librarymanagement.loan.repository.LoanRepository;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.Comparator;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LoanAggregateService {

    private final LoanRepository loanRepository;
    private final LoanItemRepository loanItemRepository;
    private final EntityManager entityManager;
    private final Clock clock;

    /** Gom đọc và cập nhật Loan theo ID tăng dần để các promotion khác Book không tạo vòng chờ khóa. */
    public void refresh(Collection<Integer> loanIds) {
        if (loanIds.isEmpty()) return;
        entityManager.flush();
        var items = loanItemRepository.findByLoanIdIn(loanIds).stream()
                .collect(Collectors.groupingBy(item -> item.getLoan().getId(),
                        Collectors.mapping(LoanItem::getStatus, Collectors.toList())));
        var loans = loanRepository.findAllById(loanIds).stream().sorted(Comparator.comparing(Loan::getId)).toList();
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
        for (Loan loan : loans) {
            int changed = loanRepository.updateAggregate(loan.getId(), loan.getVersion(),
                    LoanStatusCalculator.calculate(items.get(loan.getId())), now);
            if (changed != 1) throw new ObjectOptimisticLockingFailureException(Loan.class, loan.getId());
            // Bulk CAS bỏ qua dirty checking; bỏ snapshot cũ để lần đọc DTO lấy đúng version sau cập nhật.
            entityManager.detach(loan);
        }
    }
}
