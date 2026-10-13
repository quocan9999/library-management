package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import sparkminds.librarymanagement.auth.entity.EmailChangeVerification;

import java.time.LocalDateTime;
import java.util.Optional;

public interface EmailChangeVerificationRepository extends JpaRepository<EmailChangeVerification, Integer> {
    // Lấy bản ghi yêu cầu đổi email mới nhất của account,
    // với điều kiện yêu cầu đó chưa được sử dụng.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<EmailChangeVerification> findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDescIdDesc(Integer accountId);

    Optional<EmailChangeVerification> findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDesc(Integer accountId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select verification from EmailChangeVerification verification where verification.id = :verificationId")
    Optional<EmailChangeVerification> findByIdForUpdate(@Param("verificationId") Integer verificationId);

    @Modifying(flushAutomatically = true)
    @Query("update EmailChangeVerification verification set verification.usedAt = :usedAt "
            + "where verification.account.id = :accountId and verification.usedAt is null")
    int invalidatePendingForAccount(@Param("accountId") Integer accountId, @Param("usedAt") LocalDateTime usedAt);

}
