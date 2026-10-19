package sparkminds.librarymanagement.loan.service;

import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.OptimisticLockException;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import sparkminds.librarymanagement.common.api.BusinessException;

import java.util.function.Supplier;

@Component
@RequiredArgsConstructor
public class BorrowRetryExecutor {

    private static final int MAX_ATTEMPTS = 3;
    private final PlatformTransactionManager transactionManager;
    private final EntityManagerFactory entityManagerFactory;

    /**
     * Mỗi retry có transaction và persistence context mới; không tiếp tục dùng Hibernate session đã lỗi.
     * OSIV chỉ bị tạm tháo khi không có transaction ngoài, rồi được trả lại để giữ vòng đời MVC hiện hữu.
     */
    public <T> T execute(Supplier<T> action) {
        Object viewContext = TransactionSynchronizationManager.isActualTransactionActive() ? null
                : TransactionSynchronizationManager.unbindResourceIfPossible(entityManagerFactory);
        try {
            TransactionTemplate transaction = new TransactionTemplate(transactionManager);
            transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            transaction.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
            for (int attempt = 1; ; attempt++) {
                try {
                    return transaction.execute(status -> action.get());
                } catch (OptimisticLockingFailureException | OptimisticLockException exception) {
                    if (attempt == MAX_ATTEMPTS) {
                        throw new BusinessException(HttpStatus.CONFLICT, "BORROW_VERSION_CONFLICT",
                                "Dữ liệu mượn sách vừa thay đổi. Hãy tải lại và thử lại.");
                    }
                }
            }
        } finally {
            if (viewContext != null) {
                TransactionSynchronizationManager.bindResource(entityManagerFactory, viewContext);
            }
        }
    }
}
