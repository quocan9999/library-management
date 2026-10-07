package sparkminds.librarymanagement.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import sparkminds.librarymanagement.auth.entity.EmailChangeVerification;

import java.util.Optional;

public interface EmailChangeVerificationRepository extends JpaRepository<EmailChangeVerification, Integer> {
    // Lấy bản ghi yêu cầu đổi email mới nhất của account,
    // với điều kiện yêu cầu đó chưa được sử dụng.
    Optional<EmailChangeVerification> findTopByAccountIdAndUsedAtIsNullOrderByCreatedAtDesc(Integer accountId);
}
